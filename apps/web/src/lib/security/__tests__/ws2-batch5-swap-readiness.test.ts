/**
 * WS-2 Batch 5 — finální swap readiness (static code guard).
 *
 * Cíl: ověřit, že všechny SWAP-CRITICAL mutace + API routy jsou přepojené na
 * tenant GUC (`withAuthContext` / `withTenantContextFromAuth`) a nepouští
 * globální `db.*` proti tenant-scoped tabulkám. Test je STATICKÝ (scanuje
 * zdrojové soubory) — živé RLS ověření běží přes migraci + smoke testy proti
 * staging DB.
 *
 * Pokud někdo vrátí mutaci zpět na globální `db.insert / db.update / db.delete`
 * nebo odstraní wrapper v jedné z níže uvedených cest, tento test padne dřív,
 * než se pustí přepnutí `DATABASE_URL` na `aidvisora_app` runtime role.
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

/**
 * Spočítá výskyty mutací přes globální `db`. Bere `db.insert(`, `db.update(`,
 * `db.delete(`, `db.execute(`, a rovněž pattern `await db\n.insert(` (tj.
 * začátek řetězce na novém řádku). Neřeší `db.transaction` — ten je vzácný
 * a sám si nastavuje GUCs; kde byl v Batch 5 potřeba, je přepsaný na
 * `withTenantContextFromAuth`.
 */
function countLegacyDbMutations(src: string): number {
  const singleLine = src.match(/\bdb\s*\.(insert|update|delete|execute)\(/g) ?? [];
  const multiLine =
    src.match(/\bawait\s+db\s*\n\s*\.(insert|update|delete|execute)\(/g) ?? [];
  return singleLine.length + multiLine.length;
}

describe("WS-2 Batch 5 — mutations in swap-critical server actions", () => {
  const mutationFiles: string[] = [
    "apps/web/src/app/actions/contacts.ts",
    "apps/web/src/app/actions/contracts.ts",
    "apps/web/src/app/actions/tasks.ts",
    "apps/web/src/app/actions/events.ts",
    "apps/web/src/app/actions/messages.ts",
    "apps/web/src/app/actions/households.ts",
    "apps/web/src/app/actions/documents.ts",
  ];

  for (const file of mutationFiles) {
    it(`${file} nemá žádné globální db.insert/update/delete`, () => {
      expect(exists(file), `${file} missing`).toBe(true);
      const src = read(file);
      const legacy = countLegacyDbMutations(src);
      expect(legacy, `${file} má ${legacy} legacy db mutations`).toBe(0);
    });

    it(`${file} používá withAuthContext nebo withTenantContextFromAuth`, () => {
      const src = read(file);
      const hasWrapper =
        /\bwithAuthContext\s*\(/.test(src) ||
        /\bwithTenantContextFromAuth\s*\(/.test(src) ||
        /\bwithClientAuthContext\s*\(/.test(src);
      expect(hasWrapper, `${file} nemá žádný tenant wrapper`).toBe(true);
    });
  }
});

describe("WS-2 Batch 5 — swap-critical API routes wired to tenant context", () => {
  const criticalRoutes: string[] = [
    "apps/web/src/app/api/documents/upload/route.ts",
    "apps/web/src/app/api/documents/quick-upload/route.ts",
    "apps/web/src/app/api/documents/[id]/download/route.ts",
    "apps/web/src/app/api/documents/[id]/process/route.ts",
    "apps/web/src/app/api/messages/attachments/[id]/download/route.ts",
    "apps/web/src/app/api/calendar/events/route.ts",
    "apps/web/src/app/api/calendar/sync/route.ts",
    "apps/web/src/app/api/calendar/status/route.ts",
    "apps/web/src/app/api/calendar/disconnect/route.ts",
    "apps/web/src/app/api/calendar/oauth/callback/route.ts",
    "apps/web/src/app/api/gmail/status/route.ts",
    "apps/web/src/app/api/drive/status/route.ts",
    "apps/web/src/app/api/portal/feedback/route.ts",
    "apps/web/src/app/api/push/devices/route.ts",
    "apps/web/src/app/api/admin/settings/update/route.ts",
  ];

  for (const file of criticalRoutes) {
    it(`${file} obaluje DB operace do tenant contextu`, () => {
      expect(exists(file), `${file} missing`).toBe(true);
      const src = read(file);
      const hasWrapper =
        /\bwithTenantContext\s*\(/.test(src) ||
        /\bwithAuthContext\s*\(/.test(src) ||
        /\bwithClientAuthContext\s*\(/.test(src) ||
        /\bwithTenantContextFromAuth\s*\(/.test(src);
      expect(hasWrapper, `${file} nemá žádný tenant wrapper`).toBe(true);
    });

    it(`${file} už nevolá globální db.insert/update/delete`, () => {
      const src = read(file);
      const legacy = countLegacyDbMutations(src);
      expect(legacy, `${file} má ${legacy} legacy db mutations`).toBe(0);
    });
  }
});

describe("WS-2 Batch 5 — helpers fail-closed bez tenant", () => {
  it("withTenantContext trvá na validním UUID tenantId", () => {
    const src = read("apps/web/src/lib/db/with-tenant-context.ts");
    expect(src).toMatch(/assertUuid\(options\.tenantId/);
    expect(src).toMatch(/return\s+db\.transaction/);
    expect(src).toMatch(/set_config\('app\.tenant_id'/);
  });

  it("with-auth-context deleguje na require-auth (fail-closed)", () => {
    const src = read("apps/web/src/lib/auth/with-auth-context.ts");
    expect(src).toMatch(/requireAuthInAction\(\)/);
    expect(src).toMatch(/requireClientZoneAuth\(\)/);
    expect(src).toMatch(/withTenantContext\(/);
  });
});
