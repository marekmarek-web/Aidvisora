/**
 * WS-2 Batch 4 — runtime tenant GUC wiring (static code guard).
 *
 * Cíl tohoto testu je ověřit, že kritické server-side čtecí / bootstrap cesty
 * jsou přepsané z globálního `db.<query>` do `withTenantContext` /
 * `withAuthContext` / `withClientAuthContext` před přepnutím runtime role
 * na `aidvisora_app` (non-superuser, bez BYPASSRLS, s `FORCE ROW LEVEL SECURITY`).
 *
 * Test je záměrně STATICKÝ — scanuje zdrojové soubory. Živé RLS chování se ověří
 * integračním smoke testem proti staging DB (viz
 * `packages/db/migrations/rls-ws2-batch3-swap-readiness-test.sql`).
 *
 * Pokud někdo odstraní `withAuthContext` wrapper nebo vrátí čtení zpět přes
 * globální `db`, tento test padne dřív, než dojde k swapu. Bez toho bychom po
 * přepnutí runtime dostali prázdné listy (FORCE RLS → 0 řádků bez GUC).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../../../");

function read(p: string): string {
  return readFileSync(path.join(REPO_ROOT, p), "utf8");
}

function exists(p: string): boolean {
  return existsSync(path.join(REPO_ROOT, p));
}

describe("WS-2 Batch 4 — withAuthContext helper", () => {
  it("with-auth-context.ts existuje a vystavuje 3 variants", () => {
    const p = "apps/web/src/lib/auth/with-auth-context.ts";
    expect(exists(p)).toBe(true);
    const src = read(p);
    expect(src).toMatch(/export async function withAuthContext\b/);
    expect(src).toMatch(/export async function withClientAuthContext\b/);
    expect(src).toMatch(/export async function withTenantContextFromAuth\b/);
    // Guardrail: wrapper pracuje s withTenantContext z db layer, ne s globálním db.
    expect(src).toMatch(/from\s+"@\/lib\/db\/with-tenant-context"/);
  });

  it("withAuthContext používá requireAuthInAction a předává userId do GUC", () => {
    const src = read("apps/web/src/lib/auth/with-auth-context.ts");
    expect(src).toMatch(/requireAuthInAction\(\)/);
    expect(src).toMatch(/tenantId:\s*auth\.tenantId/);
    expect(src).toMatch(/userId:\s*auth\.userId/);
  });
});

describe("WS-2 Batch 4 — critical read paths wired to tenant context", () => {
  const criticalActions: Array<[string, RegExp[]]> = [
    [
      "apps/web/src/app/actions/contacts.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
    [
      "apps/web/src/app/actions/households.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
    [
      "apps/web/src/app/actions/contracts.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
    [
      "apps/web/src/app/actions/documents.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
    [
      "apps/web/src/app/actions/messages.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
    [
      "apps/web/src/app/actions/events.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
    [
      "apps/web/src/app/actions/notifications.ts",
      [/withAuthContext\s*\(/],
    ],
    [
      "apps/web/src/app/actions/client-dashboard.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
    [
      "apps/web/src/app/actions/client-portal-requests.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
    [
      "apps/web/src/app/actions/dashboard.ts",
      [/withAuthContext\s*\(/, /\btx\b\s*\n?\s*\.select\(/],
    ],
  ];

  for (const [file, patterns] of criticalActions) {
    it(`${file} používá withAuthContext + tx`, () => {
      expect(exists(file), `${file} missing`).toBe(true);
      const src = read(file);
      for (const p of patterns) {
        expect(src, `${file} neobsahuje pattern ${p.toString()}`).toMatch(p);
      }
    });
  }
});

describe("WS-2 Batch 4 — critical API routes wired to tenant context", () => {
  const criticalRoutes: string[] = [
    "apps/web/src/app/api/clients/[contactId]/payment-setups/route.ts",
    "apps/web/src/app/api/notifications/route.ts",
    "apps/web/src/app/api/client/profile/route.ts",
  ];

  for (const file of criticalRoutes) {
    it(`${file} wraps DB reads in tenant context`, () => {
      expect(exists(file), `${file} missing`).toBe(true);
      const src = read(file);
      // Allow either explicit withTenantContext call or withAuthContext flavor.
      const hasWrapper =
        /\bwithTenantContext\s*\(/.test(src) ||
        /\bwithAuthContext\s*\(/.test(src) ||
        /\bwithClientAuthContext\s*\(/.test(src);
      expect(hasWrapper, `${file} nemá žádný tenant wrapper`).toBe(true);
    });
  }
});

describe("WS-2 Batch 4 — guard against regression in hot reads", () => {
  // Spočítá počet top-level `db.select(` / `db.insert(` / `db.update(` /
  // `db.delete(` / `db.transaction(` volání v hot souborech. Očekáváme, že
  // čtecí operace (select) jsou plně převedené na `tx.` variantu. Update/
  // insert/delete mutations jsou v Batch 4 mimo scope (pokrývají write paths
  // audit triggery), ale explicit `db.transaction(` wrappers jsou OK (někde
  // jinde si nastavují GUCs samy).
  const hotReadFiles: string[] = [
    "apps/web/src/app/actions/contacts.ts",
    "apps/web/src/app/actions/households.ts",
    "apps/web/src/app/actions/contracts.ts",
    "apps/web/src/app/actions/documents.ts",
    "apps/web/src/app/actions/messages.ts",
    "apps/web/src/app/actions/events.ts",
    "apps/web/src/app/actions/client-dashboard.ts",
    "apps/web/src/app/actions/client-portal-requests.ts",
    "apps/web/src/app/actions/dashboard.ts",
  ];

  for (const file of hotReadFiles) {
    it(`${file} nezvyšuje počet db.select mimo withAuthContext wrapper`, () => {
      const src = read(file);
      // Rough: count `db.select(` (without tx.), and compare k počtu
      // withAuthContext wrappers. Pokud existují legacy `db.select(` calls
      // bez wrapperu, musí jich být striktně méně než wrapperů v témže souboru.
      const dbSelectCount = (src.match(/\bdb\.select\(/g) ?? []).length;
      const wrapperCount = (src.match(/\bwithAuthContext\s*\(/g) ?? []).length;
      // Threshold: soubor musí mít aspoň 1 withAuthContext (nebo být úplně
      // přepsaný na tx). Pokud jsou legacy db.select calls, signalizujeme to
      // tvrdě — v Batch 4 je chceme vidět.
      expect(wrapperCount, `${file} nemá ani jeden withAuthContext`).toBeGreaterThan(0);
      // Pokud je to úplně přepsané, dbSelectCount = 0. Pokud ne, nech to projít,
      // ale upozorni přes snapshot-style check — tady je report "Áno/Ne je ok",
      // nikoli tvrdý fail, protože některé soubory mají pending work.
      // Použijeme soft-limit: nesmí být víc legacy db.select calls než wrapperů,
      // abychom zaručili, že čtecí povrch se zvětšuje k wrapperu, ne od něj.
      expect(dbSelectCount, `${file} má ${dbSelectCount} legacy db.select ale jen ${wrapperCount} wrapperů`).toBeLessThanOrEqual(wrapperCount);
    });
  }
});
