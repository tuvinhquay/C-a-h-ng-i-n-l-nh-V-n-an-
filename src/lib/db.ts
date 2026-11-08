import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import authSchema from "../../migrations/0001_auth.sql?raw";
import appSchema from "../../migrations/0002_shared_workspaces.sql?raw";
import recoverySchema from "../../migrations/0003_password_recovery.sql?raw";
import accessKeySchema from "../../migrations/0004_access_key.sql?raw";

type Row = Record<string, unknown>;

export interface Sql {
  <T extends Row = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T extends Row = Row>(text: string, values?: readonly unknown[]): Promise<T[]>;
}

export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    undefined
  );
}

type Queryable = {
  query<T extends Row>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>;
};

const globalDatabase = globalThis as typeof globalThis & {
  __shopPglite?: PGlite;
  __shopPool?: pg.Pool;
  __shopDbReady?: Promise<void>;
  __shopPostgresDbReady?: Promise<void>;
};

const postgresMigrations = [
  { name: "0001_auth.sql", sql: authSchema },
  { name: "0002_shared_workspaces.sql", sql: appSchema },
  { name: "0003_password_recovery.sql", sql: recoverySchema },
  { name: "0004_access_key.sql", sql: accessKeySchema },
] as const;

export function getPglite(): PGlite {
  globalDatabase.__shopPglite ??= new PGlite();
  return globalDatabase.__shopPglite;
}

export function ensureDbReady(): Promise<void> {
  globalDatabase.__shopDbReady ??= (async () => {
    const client = getPglite();
    await client.exec(authSchema);
    await client.exec(appSchema);
    await client.exec(recoverySchema);
    await client.exec(accessKeySchema);
  })().catch((error: unknown) => {
    globalDatabase.__shopDbReady = undefined;
    throw error;
  });
  return globalDatabase.__shopDbReady;
}

async function ensurePostgresDbReady(pool: pg.Pool): Promise<void> {
  globalDatabase.__shopPostgresDbReady ??= (async () => {
    const client = await pool.connect();
    let failed = false;
    let currentMigration = "migration ledger";
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [814320041]);
      await client.query(
        "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
      );
      const appliedRows = await client.query<{ name: string }>(
        "SELECT name FROM _migrations",
      );
      const applied = new Set(appliedRows.rows.map(({ name }) => name));

      for (const migration of postgresMigrations) {
        if (applied.has(migration.name)) continue;
        currentMigration = migration.name;
        await client.query(migration.sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [
          migration.name,
        ]);
      }
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the migration error if the connection has already failed.
      }
      failed = true;
      const reason = error instanceof Error ? error.message : String(error);
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "unknown";
      console.error(
        `[db:migrate] failed applying ${currentMigration} (${code}): ${reason}`,
      );
      throw error;
    } finally {
      client.release(failed ? new Error("Database migration failed") : undefined);
    }
  })().catch((error: unknown) => {
    globalDatabase.__shopPostgresDbReady = undefined;
    const reason = error instanceof Error ? error.message : String(error);
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
    console.error(`[db:migrate] PostgreSQL initialization failed (${code}): ${reason}`);
    throw error;
  });
  return globalDatabase.__shopPostgresDbReady;
}

function createSql(queryable: Queryable): Sql {
  const query = async <T extends Row>(text: string, values: readonly unknown[] = []) => {
    const result = await queryable.query<T>(text, [...values]);
    return result.rows;
  };
  const sql = (async <T extends Row>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      text += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    return query<T>(text, values);
  }) as Sql;
  sql.query = query;
  return sql;
}

export async function getSql(): Promise<Sql> {
  const connectionString = getDatabaseUrl();
  if (connectionString) {
    globalDatabase.__shopPool ??= new pg.Pool({ connectionString, max: 5 });
    await ensurePostgresDbReady(globalDatabase.__shopPool);
    return createSql(globalDatabase.__shopPool);
  }

  await ensureDbReady();
  return createSql(getPglite());
}

export const dbSource = getDatabaseUrl() ? "postgres" : "pglite";
