import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { env } from "@/lib/env/server";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as typeof globalThis & {
  postgresClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.postgresClient ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "development" ? 5 : 10,
    prepare: false,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | Transaction;
