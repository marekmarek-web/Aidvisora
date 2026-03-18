/**
 * Create a Drizzle client with the shared schema. Use this in the app so that
 * the client and schema share the same drizzle-orm types (avoids duplicate
 * resolution type errors in monorepos).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import type postgres from "postgres";
import * as schema from "./schema/index";

export type PostgresClient = ReturnType<typeof postgres>;

export function createDb(client: PostgresClient) {
  return drizzle(client, { schema });
}
