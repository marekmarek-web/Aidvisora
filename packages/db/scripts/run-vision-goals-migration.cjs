/**
 * Spustí migraci advisor_vision_goals bez tsx (pouze Node + postgres).
 * Z kořene repo: pnpm --filter db migrate:vision-goals
 * Nebo z packages/db: node scripts/run-vision-goals-migration.cjs
 */
const { readFileSync, existsSync } = require("fs");
const { join, resolve } = require("path");
const postgres = require("postgres");

function loadEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const cwd = process.cwd();
loadEnv(resolve(cwd, "apps", "web", ".env.local"));
loadEnv(resolve(cwd, "..", "..", "apps", "web", ".env.local"));
loadEnv(resolve(__dirname, "..", "..", "apps", "web", ".env.local"));

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DIRECT_URL ||
  "";
if (!connectionString) {
  console.error("Nastav DATABASE_URL nebo SUPABASE_DB_URL v apps/web/.env.local");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

const statements = [
  `CREATE TABLE IF NOT EXISTS "advisor_vision_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "progress_pct" integer DEFAULT 0 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "advisor_vision_goals_tenant_user_idx" ON "advisor_vision_goals" USING btree ("tenant_id","user_id")`,
];

async function run() {
  try {
    for (const statement of statements) {
      await sql.unsafe(statement);
    }
    console.log("Tabulka advisor_vision_goals je připravena.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
