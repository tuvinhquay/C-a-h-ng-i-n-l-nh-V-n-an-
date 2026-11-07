import { createHash, randomBytes, randomUUID } from "node:crypto";
import { parseBackup } from "@/lib/backup";
import { getSql } from "@/lib/db";
import { findSyncConflicts, mergeSyncDocuments } from "@/lib/sync";
import type { Snapshot, SyncDocument, SyncTombstone } from "@/lib/types";

const TOMBSTONE_COLLECTIONS = new Set(["parts", "moves", "customers", "repairs", "quotes", "invoices"]);
const MAX_DOCUMENT_BYTES = 10_000_000;
const MAX_DOCUMENT_ROWS = 50_000;
const ONLINE_WINDOW_SECONDS = 90;

export interface DeviceInput {
  id: string;
  name: string;
}

interface WorkspaceRow extends Record<string, unknown> {
  workspace_id: string;
  name: string;
  created_by: string;
  role: "admin" | "member";
  revision: number | string;
  snapshot: unknown;
  tombstones: unknown;
}

function documentFrom(snapshot: unknown, tombstones: unknown): SyncDocument {
  const parsedBackup = parseBackup({
    ...(typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot as object),
    app: "so-dien-lanh",
    version: 1,
  });
  const parsedSnapshot: Snapshot = {
    settings: parsedBackup.settings,
    parts: parsedBackup.parts,
    moves: parsedBackup.moves,
    customers: parsedBackup.customers,
    repairs: parsedBackup.repairs,
    quotes: parsedBackup.quotes,
    invoices: parsedBackup.invoices,
  };
  const entries = typeof tombstones === "string" ? JSON.parse(tombstones) : tombstones;
  if (!Array.isArray(entries)) throw new Error("Dữ liệu đồng bộ trên máy chủ bị hỏng.");
  const parsedTombstones: SyncTombstone[] = entries.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !TOMBSTONE_COLLECTIONS.has((entry as SyncTombstone).collection) ||
      typeof (entry as SyncTombstone).id !== "string" ||
      typeof (entry as SyncTombstone).deletedAt !== "string"
    ) {
      throw new Error("Dữ liệu xóa đồng bộ trên máy chủ không hợp lệ.");
    }
    return {
      collection: (entry as SyncTombstone).collection,
      id: (entry as SyncTombstone).id,
      deletedAt: (entry as SyncTombstone).deletedAt,
    };
  });
  return { snapshot: parsedSnapshot, tombstones: parsedTombstones };
}

function validateDocument(value: unknown): SyncDocument {
  if (!value || typeof value !== "object") throw new Error("Dữ liệu đồng bộ không hợp lệ.");
  const source = value as { snapshot?: unknown; tombstones?: unknown };
  const document = documentFrom(source.snapshot, source.tombstones ?? []);
  const rowCount =
    document.snapshot.parts.length +
    document.snapshot.moves.length +
    document.snapshot.customers.length +
    document.snapshot.repairs.length +
    document.snapshot.quotes.length +
    document.snapshot.invoices.length +
    document.tombstones.length;
  if (rowCount > MAX_DOCUMENT_ROWS || JSON.stringify(document).length > MAX_DOCUMENT_BYTES) {
    throw new Error("Sổ dữ liệu quá lớn để đồng bộ.");
  }
  return document;
}

function validateDevice(device: DeviceInput): DeviceInput {
  const id = device?.id?.trim();
  const name = device?.name?.trim();
  if (!id || id.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Mã thiết bị không hợp lệ.");
  }
  return { id, name: name?.slice(0, 60) || `Thiết bị ${id.slice(0, 6)}` };
}

function dateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function touchDevice(workspaceId: string, userId: string, deviceInput: DeviceInput): Promise<void> {
  const device = validateDevice(deviceInput);
  const sql = await getSql();
  await sql`
    insert into workspace_devices (workspace_id, user_id, device_id, name, last_seen_at)
    values (${workspaceId}, ${userId}, ${device.id}, ${device.name}, now())
    on conflict (workspace_id, user_id, device_id)
    do update set name = excluded.name, last_seen_at = now()
  `;
}

export async function fetchWorkspace(userId: string, device: DeviceInput) {
  const sql = await getSql();
  const rows = await sql.query<WorkspaceRow>(
    `select w.id as workspace_id, w.name, w.created_by, m.role, s.revision, s.snapshot, s.tombstones
       from workspace_members m
       join workspaces w on w.id = m.workspace_id
       join workspace_state s on s.workspace_id = w.id
      where m.user_id = $1
      limit 1`,
    [userId],
  );
  const workspace = rows[0];
  if (!workspace) return null;

  await Promise.all([
    sql`update workspace_members set last_seen_at = now() where workspace_id = ${workspace.workspace_id} and user_id = ${userId}`,
    touchDevice(workspace.workspace_id, userId, device),
  ]);
  const memberRows = await sql.query<{
    user_id: string;
    device_id: string;
    name: string;
    last_seen_at: string | Date;
    role: "admin" | "member";
  }>(
    `select d.user_id, d.device_id, d.name, d.last_seen_at, m.role
       from workspace_devices d
       join workspace_members m on m.workspace_id = d.workspace_id and m.user_id = d.user_id
      where d.workspace_id = $1
      order by d.last_seen_at desc`,
    [workspace.workspace_id],
  );
  const invites =
    workspace.role === "admin"
      ? await sql.query<{
          id: string;
          created_at: string | Date;
          expires_at: string | Date;
          revoked_at: string | Date | null;
          uses_remaining: number;
        }>(
          `select id, created_at, expires_at, revoked_at, uses_remaining
             from workspace_invites
            where workspace_id = $1
            order by created_at desc`,
          [workspace.workspace_id],
        )
      : [];
  return {
    id: workspace.workspace_id,
    name: workspace.name,
    ownerId: workspace.created_by,
    role: workspace.role,
    revision: Number(workspace.revision),
    document: documentFrom(workspace.snapshot, workspace.tombstones),
    devices: memberRows.map((entry) => {
      const lastSeenAt = dateString(entry.last_seen_at);
      return {
        userId: entry.user_id,
        deviceId: entry.device_id,
        name: entry.name,
        role: entry.role,
        lastSeenAt,
        online: Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_SECONDS * 1000,
      };
    }),
    invites: invites.map((entry) => ({
      id: entry.id,
      createdAt: dateString(entry.created_at),
      expiresAt: dateString(entry.expires_at),
      revokedAt: entry.revoked_at ? dateString(entry.revoked_at) : null,
      usesRemaining: entry.uses_remaining,
    })),
  };
}

export async function createWorkspace(userId: string, name: string, rawDocument: unknown, device: DeviceInput) {
  const sql = await getSql();
  const existing = await sql.query<{ workspace_id: string }>(
    "select workspace_id from workspace_members where user_id = $1 limit 1",
    [userId],
  );
  if (existing.length) throw new Error("Tài khoản này đã tham gia một hệ thống khác.");
  const document = validateDocument(rawDocument);
  const workspaceId = randomUUID();
  const cleanedName = name.trim().slice(0, 80) || "Cửa hàng điện lạnh";
  const cleanDevice = validateDevice(device);
  const saved = JSON.stringify(document.snapshot);
  const rows = await sql.query<{ id: string }>(
    `with workspace_row as (
       insert into workspaces (id, name, created_by)
       values ($1, $2, $3)
       returning id
     ),
     member_row as (
       insert into workspace_members (workspace_id, user_id, role)
       select id, $3, 'admin' from workspace_row
       returning workspace_id
     ),
     state_row as (
       insert into workspace_state (workspace_id, revision, snapshot, tombstones)
       select workspace_id, 1, $4::jsonb, $5::jsonb from member_row
       returning workspace_id
     ),
     history_row as (
       insert into workspace_history (workspace_id, revision, snapshot, tombstones, actor_user_id)
       select workspace_id, 1, $4::jsonb, $5::jsonb, $3 from state_row
     ),
     device_row as (
       insert into workspace_devices (workspace_id, user_id, device_id, name)
       select workspace_id, $3, $6, $7 from member_row
     )
     select id from workspace_row`,
    [
      workspaceId,
      cleanedName,
      userId,
      saved,
      JSON.stringify(document.tombstones),
      cleanDevice.id,
      cleanDevice.name,
    ],
  );
  if (!rows[0]) throw new Error("Không tạo được hệ thống dùng chung.");
  return workspaceId;
}

export async function createInvite(userId: string, device: DeviceInput) {
  const workspace = await fetchWorkspace(userId, device);
  if (!workspace) throw new Error("Hãy tạo hoặc tham gia một hệ thống trước.");
  if (workspace.role !== "admin") throw new Error("Chỉ quản trị viên mới tạo được mã mời.");

  const token = `VA-${randomBytes(24).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `insert into workspace_invites (id, workspace_id, token_hash, created_by, expires_at, uses_remaining)
     values ($1, $2, $3, $4, now() + interval '7 days', 20)
     returning id`,
    [randomUUID(), workspace.id, tokenHash, userId],
  );
  if (!rows[0]) throw new Error("Không tạo được mã mời.");
  return { token, inviteId: rows[0].id };
}

export async function joinWorkspace(userId: string, token: string, deviceInput: DeviceInput) {
  const normalizedToken = token.trim();
  if (!/^VA-[a-zA-Z0-9_-]{30,60}$/.test(normalizedToken)) throw new Error("Mã mời không hợp lệ.");
  const sql = await getSql();
  const existing = await sql.query<{ workspace_id: string }>(
    "select workspace_id from workspace_members where user_id = $1 limit 1",
    [userId],
  );
  if (existing.length) throw new Error("Tài khoản này đã tham gia một hệ thống khác.");
  const hash = createHash("sha256").update(normalizedToken).digest("hex");
  const joined = await sql.query<{ workspace_id: string }>(
    `with valid_invite as (
       select id, workspace_id
         from workspace_invites
        where token_hash = $1 and revoked_at is null and expires_at > now() and uses_remaining > 0
        for update
     ),
     joined as (
       insert into workspace_members (workspace_id, user_id, role)
       select workspace_id, $2, 'member' from valid_invite
       on conflict (workspace_id, user_id) do nothing
       returning workspace_id
     ),
     used as (
       update workspace_invites i set uses_remaining = i.uses_remaining - 1
        from valid_invite v
       where i.id = v.id and exists (select 1 from joined)
       returning i.workspace_id
     )
     select workspace_id from joined`,
    [hash, userId],
  );
  if (!joined[0]) throw new Error("Mã mời hết hạn, đã bị thu hồi hoặc đã đủ lượt.");
  await touchDevice(joined[0].workspace_id, userId, deviceInput);
  return joined[0].workspace_id;
}

export async function revokeInvite(userId: string, inviteId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `update workspace_invites i set revoked_at = now()
      where i.id = $1 and exists (
        select 1 from workspace_members m
         where m.workspace_id = i.workspace_id and m.user_id = $2 and m.role = 'admin'
      )
      returning i.id`,
    [inviteId, userId],
  );
  if (!rows[0]) throw new Error("Không tìm thấy mã mời hoặc bạn không có quyền thu hồi.");
}

export async function removeWorkspaceMember(userId: string, memberUserId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ user_id: string }>(
    `delete from workspace_members m
      where m.user_id = $1
        and m.user_id <> $2
        and m.role = 'member'
        and exists (
          select 1 from workspace_members admin
           where admin.workspace_id = m.workspace_id and admin.user_id = $2 and admin.role = 'admin'
        )
      returning m.user_id`,
    [memberUserId, userId],
  );
  if (!rows[0]) throw new Error("Không tìm thấy thành viên hoặc bạn không có quyền xóa.");
}

export async function syncWorkspace(userId: string, rawDocument: unknown, device: DeviceInput) {
  const incoming = validateDocument(rawDocument);
  const sql = await getSql();
  const membership = await sql.query<{ workspace_id: string }>(
    "select workspace_id from workspace_members where user_id = $1 limit 1",
    [userId],
  );
  const workspaceId = membership[0]?.workspace_id;
  if (!workspaceId) throw new Error("Tài khoản chưa tham gia hệ thống dùng chung.");
  await touchDevice(workspaceId, userId, device);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const currentRows = await sql.query<{
      revision: number | string;
      snapshot: unknown;
      tombstones: unknown;
    }>("select revision, snapshot, tombstones from workspace_state where workspace_id = $1", [workspaceId]);
    const current = currentRows[0];
    if (!current) throw new Error("Không tìm thấy sổ dữ liệu dùng chung.");
    const merged = validateDocument(
      mergeSyncDocuments(incoming, documentFrom(current.snapshot, current.tombstones)),
    );
    const serialized = JSON.stringify(merged.snapshot);
    const serializedDeletes = JSON.stringify(merged.tombstones);
    const changed =
      canonical(current.snapshot) !== canonical(merged.snapshot) ||
      canonical(current.tombstones) !== canonical(merged.tombstones);
    if (!changed) {
      return {
        revision: Number(current.revision),
        document: merged,
        issues: findSyncConflicts(merged),
      };
    }

    const nextRows = await sql.query<{ revision: number | string }>(
      `update workspace_state
          set revision = revision + 1, snapshot = $2::jsonb, tombstones = $3::jsonb, updated_at = now()
        where workspace_id = $1 and revision = $4
        returning revision`,
      [workspaceId, serialized, serializedDeletes, current.revision],
    );
    const next = nextRows[0];
    if (!next) continue;
    await sql`
      insert into workspace_history (workspace_id, revision, snapshot, tombstones, actor_user_id)
      values (${workspaceId}, ${Number(next.revision)}, ${serialized}::jsonb, ${serializedDeletes}::jsonb, ${userId})
    `;
    await sql.query(
      "delete from workspace_history where workspace_id = $1 and revision < $2",
      [workspaceId, Math.max(0, Number(next.revision) - 100)],
    );
    return {
      revision: Number(next.revision),
      document: merged,
      issues: findSyncConflicts(merged),
    };
  }
  throw new Error("Sổ đang được cập nhật từ thiết bị khác. Hãy thử đồng bộ lại.");
}
