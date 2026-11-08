import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { parseRecoveryEntries, type RecoveryEntry } from "@/lib/password-recovery";
import { hashRecoveryEntries, verifyRecoveryAnswer } from "@/lib/password-recovery.server";
import { auth } from "@/lib/auth/server";

type RecoveryRow = {
  user_id: string;
  question_1: string;
  answer_salt_1: string;
  answer_hash_1: string;
  question_2: string | null;
  answer_salt_2: string | null;
  answer_hash_2: string | null;
};

const DUMMY_SALT = "00112233445566778899aabbccddeeff";
const DUMMY_HASH = "0".repeat(64);
const MAX_FAILED_ATTEMPTS = 5;
const recoveryError = "Email hoặc câu trả lời không đúng, hoặc chưa thiết lập phục hồi.";

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch (reason) {
    if (reason instanceof SyntaxError) return null;
    throw reason;
  }
}

async function saveRecoveryAnswers(userId: string, entries: RecoveryEntry[]): Promise<void> {
  const hashes = await hashRecoveryEntries(entries);
  const second = hashes[1];
  const sql = await getSql();
  await sql.query(
    `INSERT INTO password_recovery (
       user_id, question_1, answer_salt_1, answer_hash_1,
       question_2, answer_salt_2, answer_hash_2, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (user_id) DO UPDATE SET
       question_1 = EXCLUDED.question_1,
       answer_salt_1 = EXCLUDED.answer_salt_1,
       answer_hash_1 = EXCLUDED.answer_hash_1,
       question_2 = EXCLUDED.question_2,
       answer_salt_2 = EXCLUDED.answer_salt_2,
       answer_hash_2 = EXCLUDED.answer_hash_2,
       updated_at = now()`,
    [
      userId,
      entries[0]!.questionId,
      hashes[0]!.salt,
      hashes[0]!.hash,
      entries[1]?.questionId ?? null,
      second?.salt ?? null,
      second?.hash ?? null,
    ],
  );
}

async function isLocked(emailHash: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ locked: boolean }>(
    `SELECT COALESCE(locked_until > now(), false) AS locked
     FROM password_recovery_attempts WHERE email_hash = $1`,
    [emailHash],
  );
  return rows[0]?.locked ?? false;
}

async function recordFailure(emailHash: string): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `INSERT INTO password_recovery_attempts
       (email_hash, failed_count, window_started_at, locked_until)
     VALUES ($1, 1, now(), NULL)
     ON CONFLICT (email_hash) DO UPDATE SET
       failed_count = CASE
         WHEN password_recovery_attempts.window_started_at < now() - interval '15 minutes' THEN 1
         ELSE password_recovery_attempts.failed_count + 1
       END,
       window_started_at = CASE
         WHEN password_recovery_attempts.window_started_at < now() - interval '15 minutes' THEN now()
         ELSE password_recovery_attempts.window_started_at
       END,
       locked_until = CASE
         WHEN (
           CASE
             WHEN password_recovery_attempts.window_started_at < now() - interval '15 minutes' THEN 1
             ELSE password_recovery_attempts.failed_count + 1
           END
         ) >= $2 THEN now() + interval '15 minutes'
         ELSE NULL
       END`,
    [emailHash, MAX_FAILED_ATTEMPTS],
  );
}

async function resetPassword(
  email: string,
  entries: RecoveryEntry[],
  newPassword: string,
): Promise<boolean> {
  const emailHash = createHash("sha256").update(email.toLowerCase()).digest("hex");
  if (await isLocked(emailHash)) return false;

  const sql = await getSql();
  const rows = await sql.query<RecoveryRow>(
    `SELECT r.user_id, r.question_1, r.answer_salt_1, r.answer_hash_1,
            r.question_2, r.answer_salt_2, r.answer_hash_2
     FROM password_recovery r
     JOIN "user" u ON u.id = r.user_id
     WHERE lower(u.email) = lower($1)
     LIMIT 1`,
    [email],
  );
  const recovery = rows[0];
  const stored = recovery
    ? [
        {
          questionId: recovery.question_1,
          salt: recovery.answer_salt_1,
          hash: recovery.answer_hash_1,
        },
        ...(recovery.question_2 && recovery.answer_salt_2 && recovery.answer_hash_2
          ? [
              {
                questionId: recovery.question_2,
                salt: recovery.answer_salt_2,
                hash: recovery.answer_hash_2,
              },
            ]
          : []),
      ]
    : [];

  let valid = Boolean(recovery && entries.length === stored.length);
  for (let index = 0; index < 2; index += 1) {
    const saved = stored[index];
    const entry = saved
      ? entries.find((candidate) => candidate.questionId === saved.questionId)
      : entries[index];
    const answerMatches = await verifyRecoveryAnswer(
      entry?.answer ?? "",
      saved?.salt ?? DUMMY_SALT,
      saved?.hash ?? DUMMY_HASH,
    );
    if (!entry && !saved) continue;
    if (!entry || !saved || entry.questionId !== saved.questionId || !answerMatches) {
      valid = false;
    }
  }

  if (!valid || !recovery) {
    await recordFailure(emailHash);
    return false;
  }

  const context = await auth.$context;
  const credential = (await context.internalAdapter.findAccounts(recovery.user_id)).find(
    (account) => account.providerId === "credential",
  );
  if (!credential) {
    await recordFailure(emailHash);
    return false;
  }
  const passwordHash = await context.password.hash(newPassword);
  await context.internalAdapter.updatePassword(recovery.user_id, passwordHash);
  await context.internalAdapter.deleteUserSessions(recovery.user_id);
  await sql.query("DELETE FROM password_recovery_attempts WHERE email_hash = $1", [emailHash]);
  return true;
}

async function handlePost(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) return jsonResponse({ error: "Origin không hợp lệ." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ error: "Yêu cầu không hợp lệ." }, 415);
  }
  const body = await readJson(request);
  if (!body) return jsonResponse({ error: "Dữ liệu gửi lên không hợp lệ." }, 400);

  if (body.action === "setup") {
    const entries = parseRecoveryEntries(body.entries);
    if (!entries) {
      return jsonResponse({ error: "Hãy chọn và trả lời 1 hoặc 2 câu hỏi bảo mật." }, 400);
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    await saveRecoveryAnswers(session.user.id, entries);
    return jsonResponse({ ok: true });
  }

  if (body.action === "reset") {
    const entries = parseRecoveryEntries(body.entries);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.newPassword === "string" ? body.newPassword : "";
    if (
      !entries ||
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      password.length > 128
    ) {
      return jsonResponse({ error: "Hãy kiểm tra email, câu trả lời và mật khẩu mới." }, 400);
    }
    if (await resetPassword(email, entries, password)) {
      return jsonResponse({ ok: true });
    }
    const emailHash = createHash("sha256").update(email.toLowerCase()).digest("hex");
    if (await isLocked(emailHash)) {
      return jsonResponse(
        { error: "Đã thử quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại." },
        429,
      );
    }
    return jsonResponse({ error: recoveryError }, 400);
  }

  return jsonResponse({ error: "Yêu cầu không hợp lệ." }, 400);
}

export const Route = createFileRoute("/api/password-recovery")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handlePost(request).catch((reason: unknown) => {
          console.error("[password-recovery] Request failed:", reason);
          return jsonResponse({ error: "Không thể hoàn tất yêu cầu lúc này." }, 500);
        }),
    },
  },
});
