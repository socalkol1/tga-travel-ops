import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/lib/db/schema";

export async function createTestDb() {
  const client = new PGlite();
  const migrationsDir = path.join(process.cwd(), "drizzle");
  const migrationFiles = (await readdir(migrationsDir))
    .filter((entry) => entry.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const migrationSql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.exec(migrationSql);
  }

  return {
    client,
    db: drizzle(client, { schema }),
  };
}
