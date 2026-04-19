/**
 * WS-2 Batch 3 — swap readiness verification (static code + migration scan).
 *
 * Živé tenant isolation testy běží proti DB staticky (viz
 * `packages/db/migrations/rls-ws2-batch3-swap-readiness-test.sql` v posledním
 * reportu / interním ověření); zde hlídáme, že:
 *   1) Migrace existuje a obsahuje všechny hard-blocker tabulky.
 *   2) `get-membership.ts` nastavuje `app.user_id` před lookupem
 *      (bootstrap RLS policy to vyžaduje).
 *   3) `withTenantContext` helper stále existuje a `withUserContext` varianta
 *      byla přidána.
 *   4) Bootstrap policies používají NULLIF pattern (bez něj spadne cast u
 *      nenastavené GUC).
 *
 * Účel: žádný fake-done. Pokud někdo odstraní/pošle back `withUserContext` nebo
 * vrátí `getMembership` na jednoduchý `db.select().from(memberships)` bez GUC
 * nastavení, tento test padne dřív než swap.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../../../");
const MIGRATION_PATH = path.join(
  REPO_ROOT,
  "packages/db/migrations/rls-ws2-batch3-swap-readiness-2026-04-19.sql"
);

function read(p: string): string {
  return readFileSync(p, "utf8");
}

describe("WS-2 Batch 3 — swap readiness (static guards)", () => {
  it("Batch 3 RLS migrace existuje", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("migrace pokrývá všechny hard-blocker tabulky bootstrap tieru", () => {
    const sql = read(MIGRATION_PATH);
    const bootstrap = [
      "memberships",
      "user_profiles",
      "tenants",
      "roles",
      "staff_invitations",
      "client_contacts",
    ];
    for (const t of bootstrap) {
      expect(sql, `bootstrap tier: ${t}`).toMatch(
        new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`)
      );
      expect(sql, `bootstrap tier force: ${t}`).toMatch(
        new RegExp(`ALTER TABLE public\\.${t} FORCE ROW LEVEL SECURITY`)
      );
    }
  });

  it("migrace pokrývá export tier (export_artifacts)", () => {
    const sql = read(MIGRATION_PATH);
    expect(sql).toMatch(/export_artifacts_via_export_select/);
    expect(sql).toMatch(/export_artifacts_via_export_insert/);
    expect(sql).toMatch(/export_artifacts_via_export_delete/);
  });

  it("migrace obsahuje core post-login tabulky s přímým tenant_id", () => {
    const sql = read(MIGRATION_PATH);
    const core = [
      "events",
      "timeline_items",
      "notification_log",
      "execution_actions",
      "mindmap_maps",
      "board_items",
      "team_tasks",
      "document_processing_jobs",
      "subscriptions",
    ];
    for (const t of core) {
      expect(sql, `core tier listuje ${t}`).toMatch(new RegExp(`'${t}'`));
    }
  });

  it("migrace obsahuje join-scoped tier", () => {
    const sql = read(MIGRATION_PATH);
    expect(sql).toMatch(/household_members_via_household_select/);
    expect(sql).toMatch(/document_versions_via_document_select/);
    expect(sql).toMatch(/document_extraction_fields_via_extraction_select/);
    expect(sql).toMatch(/abp_targets_via_plan_select/);
    expect(sql).toMatch(/mindmap_nodes/);
    expect(sql).toMatch(/mindmap_edges/);
  });

  it("migrace opravuje contracts policies — přidává aidvisora_app", () => {
    const sql = read(MIGRATION_PATH);
    expect(sql).toMatch(/DROP POLICY IF EXISTS contracts_tenant_select/);
    expect(sql).toMatch(
      /CREATE POLICY contracts_tenant_select[\s\S]+?TO authenticated,\s*aidvisora_app/
    );
  });

  it("bootstrap policies používají NULLIF pattern (safe UUID cast)", () => {
    const sql = read(MIGRATION_PATH);
    expect(sql.match(/NULLIF\(current_setting\('app\.tenant_id', true\), ''\)/g)?.length ?? 0)
      .toBeGreaterThan(10);
    expect(sql.match(/NULLIF\(current_setting\('app\.user_id', true\), ''\)/g)?.length ?? 0)
      .toBeGreaterThan(3);
  });
});

describe("WS-2 Batch 3 — application bootstrap wiring", () => {
  it("withTenantContext helper stále existuje", () => {
    const helper = read(
      path.join(REPO_ROOT, "apps/web/src/lib/db/with-tenant-context.ts")
    );
    expect(helper).toMatch(/export async function withTenantContext/);
    expect(helper).toMatch(/set_config\('app\.tenant_id'/);
  });

  it("withUserContext helper (bootstrap) je přidaný", () => {
    const helper = read(
      path.join(REPO_ROOT, "apps/web/src/lib/db/with-tenant-context.ts")
    );
    expect(helper).toMatch(/export async function withUserContext/);
    expect(helper).toMatch(/set_config\('app\.user_id'/);
  });

  it("getMembership nastavuje app.user_id GUC před lookupem", () => {
    const src = read(path.join(REPO_ROOT, "apps/web/src/lib/auth/get-membership.ts"));
    expect(src).toMatch(/db\.transaction/);
    expect(src).toMatch(/set_config\('app\.user_id'/);
  });
});
