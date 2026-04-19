/**
 * WS-2 Batch 2 — minimal audit coverage verification.
 *
 * Účel: ověřit, že modifikované server akce importují `logAuditAction` z `@/lib/audit` a že
 * klíčové symboly zůstanou exportovány, aby nedošlo k tiché regresi (např. změnou importu).
 *
 * Integrační test s reálnou DB a auth je mimo Batch 2 scope (tenant isolation test suite).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");

function read(p: string): string {
  return readFileSync(path.join(ROOT, p), "utf8");
}

describe("WS-2 Batch 2 — audit coverage on sensitive server actions", () => {
  it("apps/web/src/app/actions/contacts.ts audituje delete + update + archive", () => {
    const src = read("src/app/actions/contacts.ts");
    expect(src).toMatch(/from\s+"@\/lib\/audit"/);
    expect(src).toMatch(/action:\s*"contact\.delete"/);
    expect(src).toMatch(/action:\s*"contact\.archive"/);
    expect(src).toMatch(/action:\s*"contact\.update"/);
  });

  it("apps/web/src/app/actions/gdpr.ts audituje GDPR export pro poradce i klienta", () => {
    const src = read("src/app/actions/gdpr.ts");
    expect(src).toMatch(/from\s+"@\/lib\/audit"/);
    expect(src.match(/action:\s*"gdpr\.export"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("apps/web/src/app/actions/team.ts audituje role change", () => {
    const src = read("src/app/actions/team.ts");
    expect(src).toMatch(/from\s+"@\/lib\/audit"/);
    expect(src).toMatch(/action:\s*"team\.role_change"/);
    expect(src).toMatch(/previousRole/);
    expect(src).toMatch(/newRole/);
  });

  it("sensitive-actions registry obsahuje client_data_update + bulk_delete + document_export", () => {
    const src = read("src/lib/security/sensitive-actions.ts");
    expect(src).toMatch(/client_data_update/);
    expect(src).toMatch(/bulk_delete/);
    expect(src).toMatch(/document_export/);
  });
});
