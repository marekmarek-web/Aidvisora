import "server-only";
import postgres from "postgres";
import { createDb } from "../../../../packages/db/src/create-db";

const connectionString = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL or SUPABASE_DB_URL");
}

if (connectionString.includes("[") || connectionString.includes("]")) {
  throw new Error(
    "DATABASE_URL je placeholder (obsahuje [ref] nebo [password]). Použij skutečný connection string z Supabase."
  );
}

const isSupabase = connectionString.includes("supabase.co");
const hasSslParam = connectionString.includes("sslmode=");
const client = postgres(connectionString, {
  max: 10,
  prepare: false,
  ...(isSupabase && !hasSslParam ? { ssl: "require" as const } : {}),
});

export const db = createDb(client);
