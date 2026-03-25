/* eslint-disable @typescript-eslint/no-require-imports -- spouštění bez tsx/esbuild (Windows) */
const { config } = require("dotenv");
const { resolve } = require("path");
const { existsSync } = require("fs");
const { drizzle } = require("drizzle-orm/postgres-js");
const { migrate } = require("drizzle-orm/postgres-js/migrator");
const postgres = require("postgres");

const cwd = process.cwd();
const envCandidates = [
  resolve(cwd, "apps/web/.env.local"),
  resolve(cwd, "../../apps/web/.env.local"),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    config({ path: p });
    break;
  }
}

const connectionString = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "";
if (!connectionString) {
  console.error("Set DATABASE_URL or SUPABASE_DB_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
  const migrationsFolder = resolve(cwd, "drizzle");
  await migrate(db, { migrationsFolder });
  console.log("Migrations done.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
