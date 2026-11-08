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

type Queryable = {
  query<T extends Row>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>;
};

const globalDatabase = globalThis as typeof globalThis & {
  __shopPglite?: PGlite;
  __shopPool?: pg.Pool;
  __shopDbReady?: Promise<void>;
};

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
  const connectionString = process.env.DATABASE_URL?.trim();
  if (connectionString) {
    globalDatabase.__shopPool ??= new pg.Pool({ connectionString, max: 5 });
    return createSql(globalDatabase.__shopPool);
  }

  await ensureDbReady();
  return createSql(getPglite());
}

export const dbSource = process.env.DATABASE_URL?.trim() ? "postgres" : "pglite";
