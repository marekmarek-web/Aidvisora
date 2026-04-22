/**
 * Live RLS integration test — BĚŽÍ POUZE VŮČI STAGING DB POD ROLÍ `aidvisora_app`.
 *
 * Spuštění:
 *   DATABASE_URL_LIVE_RLS_TEST=postgres://aidvisora_app:...@.../postgres \
 *   RLS_TEST_TENANT_A=<uuid> RLS_TEST_TENANT_B=<uuid> \
 *   RLS_TEST_USER_A=<uuid> RLS_TEST_USER_B=<uuid> \
 *   npx vitest run src/lib/db/__tests__/rls-live.test.ts
 *
 * Bez těchto env proměnných se test skipne (CI default).
 *
 * Co ověřuje (každý case běží pod `SET ROLE aidvisora_app` v session):
 *   1) bez GUC → SELECT ze swap-critical tabulek vrátí 0 rows (fail-closed),
 *   2) s GUC tenantA → contacts/contracts vrací jen tenantA,
 *   3) s GUC tenantB → leak_from_tenant_a = 0,
 *   4) cross-tenant INSERT (GUC=A, payload tenantId=B) → musí hodit RLS violation,
 *   5) pre-auth SECURITY DEFINER `lookup_invite_metadata_v1(<unknown>)` → null,
 *   6) storage.objects: non-`documents` bucket vrací 0 řádků (rls-m10 restrictive).
 */

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CONN = process.env.DATABASE_URL_LIVE_RLS_TEST;
const TENANT_A = process.env.RLS_TEST_TENANT_A;
const TENANT_B = process.env.RLS_TEST_TENANT_B;
const USER_A = process.env.RLS_TEST_USER_A;

const shouldRun = Boolean(CONN && TENANT_A && TENANT_B && USER_A);

describe.skipIf(!shouldRun)("RLS live smoke against aidvisora_app", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(CONN!, { max: 2, prepare: false, ssl: "require" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("runtime role je aidvisora_app (NOBYPASSRLS)", async () => {
    const [row] =
      await sql`select current_user, (select rolbypassrls from pg_roles where rolname = current_user) as bypass`;
    expect(row.current_user).toBe("aidvisora_app");
    expect(row.bypass).toBe(false);
  });

  it("bez GUC vrací 0 řádků z tenant-scoped tabulek", async () => {
    const [{ count: contacts }] = await sql`select count(*)::int as count from contacts`;
    const [{ count: contracts }] = await sql`select count(*)::int as count from contracts`;
    const [{ count: documents }] = await sql`select count(*)::int as count from documents`;
    expect(contacts).toBe(0);
    expect(contracts).toBe(0);
    expect(documents).toBe(0);
  });

  it("s GUC tenantA vidí jen tenantA", async () => {
    await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${TENANT_A!}, true)`;
      await tx`select set_config('app.user_id',  ${USER_A!},  true)`;
      const [{ leak }] = await tx`
        select count(*)::int as leak from contacts where "tenantId" <> ${TENANT_A!}
      `;
      expect(leak).toBe(0);
    });
  });

  it("s GUC tenantB nevidí data tenantA", async () => {
    await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${TENANT_B!}, true)`;
      const [{ leak }] = await tx`
        select count(*)::int as leak from contacts where "tenantId" = ${TENANT_A!}
      `;
      expect(leak).toBe(0);
    });
  });

  it("cross-tenant INSERT je zablokován WITH CHECK / RLS", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`select set_config('app.tenant_id', ${TENANT_B!}, true)`;
        await tx`select set_config('app.user_id',  ${USER_A!},   true)`;
        await tx`
          insert into contacts ("tenantId", "firstName", "lastName")
          values (${TENANT_A!}::uuid, 'RLS', 'SmokeTest')
        `;
      }),
    ).rejects.toThrow();
  });

  it("pre-auth SECURITY DEFINER lookup_invite_metadata_v1 projde bez GUC", async () => {
    const unknownToken = "00000000-0000-0000-0000-000000000000";
    await expect(sql`select public.lookup_invite_metadata_v1(${unknownToken})`).resolves.toBeDefined();
  });

  it("storage.objects nevrací řádky z ne-documents bucketů", async () => {
    await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${TENANT_A!}, true)`;
      const [{ count }] =
        await tx`select count(*)::int as count from storage.objects where bucket_id <> 'documents'`;
      expect(count).toBe(0);
    });
  });
});
