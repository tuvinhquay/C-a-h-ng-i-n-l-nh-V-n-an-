import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  formCsrfMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  accessKeyLimits,
  generateAccessKey,
  generateSetupToken,
  hashAccessKey,
  hashSetupToken,
  newInternalEmail,
  verifyAccessKey,
  verifySetupToken,
} from "./access-key.server";

type AccessKeyRow = Record<string, unknown> & {
  user_id: string;
  key_salt: string;
  key_hash: string;
};

type SetupRow = Record<string, unknown> & {
  setup_token_hash: string;
  key_salt: string;
  key_hash: string;
};

const beginBody = z.object({ restart: z.boolean().optional() });
const confirmBody = z.object({
  key: z.string().min(1).max(64),
  setupToken: z.string().min(20).max(100),
});
const signInBody = z.object({ key: z.string().min(1).max(64) });
const DUMMY_SALT = "00112233445566778899aabbccddeeff";
const DUMMY_HASH = "0".repeat(64);

function conflict(message: string) {
  return APIError.from("CONFLICT", { code: "ACCESS_KEY_CONFLICT", message });
}

async function activeKeyExists(): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM app_access_key WHERE id = 1) AS exists",
  );
  return rows[0]?.exists ?? false;
}

async function recordFailedAttempt(): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `INSERT INTO app_access_key_attempts
       (id, failed_count, window_started_at, locked_until)
     VALUES (1, 1, now(), NULL)
     ON CONFLICT (id) DO UPDATE SET
       failed_count = CASE
         WHEN app_access_key_attempts.window_started_at < now() - interval '15 minutes' THEN 1
         ELSE app_access_key_attempts.failed_count + 1
       END,
       window_started_at = CASE
         WHEN app_access_key_attempts.window_started_at < now() - interval '15 minutes' THEN now()
         ELSE app_access_key_attempts.window_started_at
       END,
       locked_until = CASE
         WHEN (
           CASE
             WHEN app_access_key_attempts.window_started_at < now() - interval '15 minutes' THEN 1
             ELSE app_access_key_attempts.failed_count + 1
           END
         ) >= $1 THEN now() + interval '15 minutes'
         ELSE NULL
       END`,
    [accessKeyLimits.failedAttempts],
  );
}

async function sessionForOwner(
  ctx: Parameters<typeof getSessionFromCtx>[0],
  ownerId: string,
) {
  const user = await ctx.context.internalAdapter.findUserById(ownerId);
  if (!user) {
    throw APIError.from("INTERNAL_SERVER_ERROR", {
      code: "ACCESS_KEY_OWNER_MISSING",
      message: "Tài khoản chủ hệ thống không tồn tại.",
    });
  }
  const session = await ctx.context.internalAdapter.createSession(user.id);
  if (!session) {
    throw APIError.from("INTERNAL_SERVER_ERROR", {
      code: "ACCESS_KEY_SESSION_FAILED",
      message: "Không thể tạo phiên đăng nhập.",
    });
  }
  try {
    const sql = await getSql();
    await sql.query(
      "INSERT INTO app_access_key_sessions (session_id, user_id) VALUES ($1, $2)",
      [session.id, user.id],
    );
    await setSessionCookie(ctx, { session, user });
  } catch (reason) {
    await ctx.context.internalAdapter.deleteSession(session.token);
    throw reason;
  }
  return { token: session.token };
}

async function chooseOwner(ctx: Parameters<typeof getSessionFromCtx>[0]) {
  const current = await getSessionFromCtx(ctx, { disableRefresh: true });
  const sql = await getSql();
  const admins = await sql.query<{ user_id: string }>(
    "SELECT DISTINCT user_id FROM workspace_members WHERE role = 'admin' ORDER BY user_id",
  );

  if (admins.length === 1) {
    const owner = await ctx.context.internalAdapter.findUserById(admins[0]!.user_id);
    if (owner) return { user: owner, created: false };
    throw APIError.from("INTERNAL_SERVER_ERROR", {
      code: "ACCESS_KEY_OWNER_MISSING",
      message: "Tài khoản quản trị hiện có không tồn tại.",
    });
  }
  if (admins.length > 1) {
    if (current?.user && admins.some((admin) => admin.user_id === current.user.id)) {
      return { user: current.user, created: false };
    }
    throw conflict(
      "Đã có nhiều tài khoản quản trị. Hãy mở thiết lập khi đang đăng nhập tài khoản chủ hiện có.",
    );
  }
  if (current?.user) return { user: current.user, created: false };

  const user = await ctx.context.internalAdapter.createUser({
    email: newInternalEmail(),
    emailVerified: true,
    name: "Cửa hàng điện lạnh Vân An",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { user, created: true };
}

export function accessKeyPlugin() {
  return {
    id: "van-an-access-key",
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === "/get-session",
          handler: createAuthMiddleware(async (ctx) => {
            const current = await getSessionFromCtx(ctx, { disableRefresh: true });
            if (!current?.session) return;
            const sql = await getSql();
            const authorization = await sql.query<{
              initialized: boolean;
              allowed: boolean;
            }>(
              `SELECT EXISTS (
                 SELECT 1 FROM app_access_key WHERE id = 1
               ) AS initialized,
               EXISTS (
                 SELECT 1
                 FROM app_access_key k
                 JOIN app_access_key_sessions s
                   ON s.user_id = k.user_id
                 WHERE k.id = 1 AND s.session_id = $1
               ) AS allowed`,
              [current.session.id],
            );
            if (!authorization[0]?.initialized) return;
            if (authorization[0]?.allowed) return;

            await ctx.context.internalAdapter.deleteSession(current.session.token);
            deleteSessionCookie(ctx);
            const headers = new Headers(ctx.request?.headers ?? ctx.headers);
            headers.delete("authorization");
            headers.delete("cookie");
            return { context: { headers, session: null } };
          }),
        },
      ],
    },
    endpoints: {
      accessKeyStatus: createAuthEndpoint(
        "/access-key/status",
        { method: "GET" },
        async (ctx) => {
          try {
            const sql = await getSql();
            const rows = await sql.query<{ initialized: boolean; setup_pending: boolean }>(
              `SELECT
                 EXISTS (SELECT 1 FROM app_access_key WHERE id = 1) AS initialized,
                 EXISTS (
                   SELECT 1 FROM app_access_key_setup
                   WHERE id = 1 AND expires_at > now()
                 ) AS setup_pending`,
            );
            return ctx.json({
              initialized: rows[0]?.initialized ?? false,
              setupPending: rows[0]?.setup_pending ?? false,
            });
          } catch (reason) {
            const rawCode =
              typeof reason === "object" && reason !== null && "code" in reason
                ? String(reason.code)
                : "UNKNOWN";
            const code = /^[0-9A-Z]{5}$/.test(rawCode) ? rawCode : "UNKNOWN";
            const message = reason instanceof Error ? reason.message : String(reason);
            console.error(
              `[auth] access-key status failed (DB ${code}): ${message}`,
            );
            throw APIError.from("INTERNAL_SERVER_ERROR", {
              code: "ACCESS_KEY_STATUS_UNAVAILABLE",
              message: `Chưa tải được trạng thái đăng nhập (mã chẩn đoán DB: ${code}). Hãy thử tải lại; nếu vẫn lỗi, quản trị viên cần kiểm tra kết nối cơ sở dữ liệu.`,
            });
          }
        },
      ),
      accessKeyBegin: createAuthEndpoint(
        "/access-key/begin",
        { method: "POST", body: beginBody, use: [formCsrfMiddleware] },
        async (ctx) => {
          if (await activeKeyExists()) throw conflict("Mã chủ đã được thiết lập.");

          const sql = await getSql();
          const existingStage = await sql.query<{ pending: boolean }>(
            `SELECT expires_at > now() AS pending
             FROM app_access_key_setup WHERE id = 1`,
          );
          if (existingStage[0]?.pending && !ctx.body.restart) {
            throw conflict("Quá trình tạo mã đã bắt đầu. Hãy chọn tạo lại để tiếp tục.");
          }

          const key = generateAccessKey();
          const setupToken = generateSetupToken();
          const hashedKey = await hashAccessKey(key);
          await sql.query(
            `INSERT INTO app_access_key_setup
               (id, setup_token_hash, key_salt, key_hash, expires_at)
             VALUES (1, $1, $2, $3, now() + interval '15 minutes')
             ON CONFLICT (id) DO UPDATE SET
               setup_token_hash = EXCLUDED.setup_token_hash,
               key_salt = EXCLUDED.key_salt,
               key_hash = EXCLUDED.key_hash,
               expires_at = EXCLUDED.expires_at`,
            [hashSetupToken(setupToken), hashedKey.salt, hashedKey.hash],
          );
          return ctx.json({ key, setupToken });
        },
      ),
      accessKeyConfirm: createAuthEndpoint(
        "/access-key/confirm",
        { method: "POST", body: confirmBody, use: [formCsrfMiddleware] },
        async (ctx) => {
          if (await activeKeyExists()) throw conflict("Mã chủ đã được thiết lập.");
          const sql = await getSql();
          const rows = await sql.query<SetupRow>(
            `SELECT setup_token_hash, key_salt, key_hash
             FROM app_access_key_setup
             WHERE id = 1 AND expires_at > now()`,
          );
          const setup = rows[0];
          const validToken = setup && verifySetupToken(ctx.body.setupToken, setup.setup_token_hash);
          const salt = setup?.key_salt ?? DUMMY_SALT;
          const hash = setup?.key_hash ?? DUMMY_HASH;
          const validKey = await verifyAccessKey(ctx.body.key, salt, hash);
          if (!setup || !validToken || !validKey) {
            throw APIError.from("BAD_REQUEST", {
              code: "ACCESS_KEY_CONFIRMATION_FAILED",
              message: "Mã xác nhận không khớp hoặc quá trình khởi tạo đã hết hạn.",
            });
          }

          const { user, created } = await chooseOwner(ctx);
          let keyPersisted = false;
          try {
            const inserted = await sql.query<{ user_id: string }>(
              `INSERT INTO app_access_key (id, user_id, key_salt, key_hash)
               SELECT 1, $1, key_salt, key_hash
               FROM app_access_key_setup
               WHERE id = 1 AND setup_token_hash = $2 AND expires_at > now()
               ON CONFLICT (id) DO NOTHING
               RETURNING user_id`,
              [user.id, setup.setup_token_hash],
            );
            if (!inserted.length) throw conflict("Mã chủ vừa được thiết lập ở thiết bị khác.");
            keyPersisted = true;
          } finally {
            if (created && !keyPersisted) {
              await ctx.context.internalAdapter.deleteUser(user.id);
            }
          }

          await sql.query(
            "DELETE FROM app_access_key_setup WHERE id = 1 AND setup_token_hash = $1",
            [setup.setup_token_hash],
          );
          await sql.query("DELETE FROM app_access_key_attempts WHERE id = 1");
          return ctx.json(await sessionForOwner(ctx, user.id));
        },
      ),
      accessKeySignIn: createAuthEndpoint(
        "/access-key/sign-in",
        { method: "POST", body: signInBody, use: [formCsrfMiddleware] },
        async (ctx) => {
          const sql = await getSql();
          const attempts = await sql.query<{ locked: boolean }>(
            `SELECT COALESCE(locked_until > now(), false) AS locked
             FROM app_access_key_attempts WHERE id = 1`,
          );
          if (attempts[0]?.locked) {
            throw APIError.from("TOO_MANY_REQUESTS", {
              code: "ACCESS_KEY_LOCKED",
              message: "Đã nhập sai quá nhiều lần. Hãy đợi 15 phút rồi thử lại.",
            });
          }

          const rows = await sql.query<AccessKeyRow>(
            `SELECT user_id, key_salt, key_hash
             FROM app_access_key WHERE id = 1`,
          );
          const keyRecord = rows[0];
          const valid = await verifyAccessKey(
            ctx.body.key,
            keyRecord?.key_salt ?? DUMMY_SALT,
            keyRecord?.key_hash ?? DUMMY_HASH,
          );
          if (!keyRecord || !valid) {
            await recordFailedAttempt();
            throw APIError.from("UNAUTHORIZED", {
              code: "INVALID_ACCESS_KEY",
              message: "Mã bí mật không đúng.",
            });
          }

          await sql.query("DELETE FROM app_access_key_attempts WHERE id = 1");
          return ctx.json(await sessionForOwner(ctx, keyRecord.user_id));
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
