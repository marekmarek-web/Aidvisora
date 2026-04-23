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

// Po B4.1 cutoveru bývá DATABASE_URL pod aidvisora_app (bez práv na migrace).
// Pro DDL použij DATABASE_URL_SERVICE (postgres / BYPASSRLS) nebo jednorázově MIGRATE_DATABASE_URL.
const connectionSource = process.env.MIGRATE_DATABASE_URL
  ? "MIGRATE_DATABASE_URL"
  : process.env.DATABASE_URL_SERVICE
    ? "DATABASE_URL_SERVICE"
    : process.env.DATABASE_URL
      ? "DATABASE_URL"
      : process.env.SUPABASE_DB_URL
        ? "SUPABASE_DB_URL"
        : null;

const connectionString =
  process.env.MIGRATE_DATABASE_URL ??
  process.env.DATABASE_URL_SERVICE ??
  process.env.DATABASE_URL ??
  process.env.SUPABASE_DB_URL ??
  "";
if (!connectionString) {
  console.error(
    "Set MIGRATE_DATABASE_URL, DATABASE_URL_SERVICE, DATABASE_URL, or SUPABASE_DB_URL",
  );
  process.exit(1);
}

console.error(`[db/migrate] Using env: ${connectionSource}`);

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
  const code = e && typeof e === "object" && "code" in e ? e.code : undefined;
  if (code === "28P01") {
    console.error(`
[db/migrate] PostgreSQL odmítl heslo (28P01).

U Supabase musí být v connection stringu heslo z Project Settings → Database → „Database password“
(účet postgres), ne heslo vlastní role aidvisora_app, pokud se liší.

Nejspolehlivější: Dashboard → Database → Connection string → Session mode (port 5432) → zkopíruj celý URI
do DATABASE_URL_SERVICE nebo MIGRATE_DATABASE_URL v apps/web/.env.local a spusť znovu pnpm db:migrate.
`);
  }
  if (code === "ENOTFOUND" || (typeof e?.message === "string" && e.message.includes("getaddrinfo ENOTFOUND"))) {
    console.error(`
[db/migrate] DNS nenašel host (ENOTFOUND). Zkus místo db.<ref>.supabase.co Session pooler z dashboardu
(aws-*-*.pooler.supabase.com, port 5432, user postgres.<ref>), viz komentář u DATABASE_URL_SERVICE v .env.local.
`);
  }
  process.exit(1);
});
