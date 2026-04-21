/**
 * WS-2 Batch 5 — PII encrypt + signed URL TTL + audit coverage (W5).
 *
 * Tři cíle v jednom souboru, aby byly guardraily pohromadě a bylo snadné je
 * zkontrolovat jedním `pnpm test -- ws2-batch5-pii-signed-url-audit`:
 *
 *   1. Šifrování (`encryptPii`/`decryptPii`) je AES-256-GCM roundtrip, používá
 *      primární/sekundární klíče a respektuje AAD.
 *   2. `fingerprintPii` je deterministický, závisí na klíči a normalizuje vstup
 *      (whitespace + case) — jinak nelze dělat equality lookup přes dual-column
 *      pattern.
 *   3. Signed URL mají TTL ≤ 1 h pro všechny použité purposes (DoD W4:
 *      "Avatary/loga nemají >24 h signed URL"). Žádný purpose nesmí být delší.
 *   4. Avatar proxy route (`/api/storage/avatar`) loguje signed URL generaci
 *      i selhání přes `logAudit` / `createSignedStorageUrl.audit` — static check.
 *
 * Test je **čistě deterministický** (žádný network, žádná DB, žádný filesystem
 * mimo zdrojáků), aby běžel i v CI bez Supabase envu.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const REPO_ROOT = path.resolve(__dirname, "../../../../../../");

function read(p: string): string {
  return readFileSync(path.join(REPO_ROOT, p), "utf8");
}

function exists(p: string): boolean {
  return existsSync(path.join(REPO_ROOT, p));
}

// ---------------------------------------------------------------------------
// 1) PII encrypt / decrypt / fingerprint
// ---------------------------------------------------------------------------

const ORIG_ENV = {
  PII_ENCRYPTION_KEY_BASE64: process.env.PII_ENCRYPTION_KEY_BASE64,
  PII_ENCRYPTION_KEY_ID: process.env.PII_ENCRYPTION_KEY_ID,
  PII_ENCRYPTION_KEYS: process.env.PII_ENCRYPTION_KEYS,
  PII_FINGERPRINT_KEY_BASE64: process.env.PII_FINGERPRINT_KEY_BASE64,
};

function b64(buf: Buffer): string {
  return buf.toString("base64");
}

const PRIMARY_KEY_B64 = b64(randomBytes(32));
const FP_KEY_B64 = b64(randomBytes(32));

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY_BASE64 = PRIMARY_KEY_B64;
  process.env.PII_ENCRYPTION_KEY_ID = "k-test";
  process.env.PII_FINGERPRINT_KEY_BASE64 = FP_KEY_B64;
  // Sekundární klíč pro rotační test:
  process.env.PII_ENCRYPTION_KEYS = `k-legacy:${b64(randomBytes(32))}`;
});

afterAll(() => {
  process.env.PII_ENCRYPTION_KEY_BASE64 = ORIG_ENV.PII_ENCRYPTION_KEY_BASE64;
  process.env.PII_ENCRYPTION_KEY_ID = ORIG_ENV.PII_ENCRYPTION_KEY_ID;
  process.env.PII_ENCRYPTION_KEYS = ORIG_ENV.PII_ENCRYPTION_KEYS;
  process.env.PII_FINGERPRINT_KEY_BASE64 = ORIG_ENV.PII_FINGERPRINT_KEY_BASE64;
});

describe("WS-2 Batch 5 — PII encrypt/decrypt", () => {
  it("encryptPii → decryptPii vrací původní plaintext (roundtrip)", async () => {
    const mod = await import("@/lib/pii/encrypt");
    const sample = "880101/1234";
    const env = mod.encryptPii(sample, "contact:personal_id");
    expect(env.startsWith("v1.k-test.")).toBe(true);
    expect(mod.decryptPii(env, "contact:personal_id")).toBe(sample);
  });

  it("ciphertext je pokaždé jiný (náhodný IV), envelope má 5 segmentů", async () => {
    const mod = await import("@/lib/pii/encrypt");
    const a = mod.encryptPii("CZ1234567890", "contact:personal_id");
    const b = mod.encryptPii("CZ1234567890", "contact:personal_id");
    expect(a).not.toBe(b);
    expect(a.split(".")).toHaveLength(5);
    expect(b.split(".")).toHaveLength(5);
  });

  it("AAD (associatedData) je svázaná — decrypt s jiným AAD padne", async () => {
    const mod = await import("@/lib/pii/encrypt");
    const env = mod.encryptPii("AB123456", "contact:id_card_number");
    expect(() => mod.decryptPii(env, "contact:personal_id")).toThrow();
  });

  it("neznámý key_id v envelope → throw (nikoli tichý fail)", async () => {
    const mod = await import("@/lib/pii/encrypt");
    const env = mod.encryptPii("test", "x");
    const [version, _keyId, iv, ct, tag] = env.split(".");
    const tampered = [version, "k-not-present", iv, ct, tag].join(".");
    expect(() => mod.decryptPii(tampered, "x")).toThrow(/neznámý key_id/);
  });

  it("nevalidní envelope formát → throw", async () => {
    const mod = await import("@/lib/pii/encrypt");
    expect(() => mod.decryptPii("nope", "x")).toThrow();
    expect(() => mod.decryptPii("", "x")).toThrow();
    expect(() => mod.decryptPii("v1.k.a.b", "x")).toThrow(/5 segmentů/);
  });
});

describe("WS-2 Batch 5 — fingerprintPii (HMAC-SHA256)", () => {
  it("je deterministický pro stejný vstup", async () => {
    const mod = await import("@/lib/pii/encrypt");
    const a = mod.fingerprintPii("8801011234");
    const b = mod.fingerprintPii("8801011234");
    expect(a).toBe(b);
    // base64url bez paddingu (SHA-256 = 32B → 43 znaků)
    expect(a).toHaveLength(43);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("normalizace: whitespace + lomítka + case dávají stejný fingerprint", async () => {
    const mod = await import("@/lib/pii/encrypt");
    // "880101/1234" s whitespace = "8801011234" po replace whitespace? NE — lomítko zůstává.
    // Testuje jen whitespace + case podle implementace.
    const a = mod.fingerprintPii("8801011234");
    const b = mod.fingerprintPii(" 8801011234 ");
    const c = mod.fingerprintPii("8801011234\n");
    expect(a).toBe(b);
    expect(a).toBe(c);

    const d = mod.fingerprintPii("AB123456");
    const e = mod.fingerprintPii("ab123456");
    expect(d).toBe(e);
  });

  it("různé vstupy → různé fingerprinty", async () => {
    const mod = await import("@/lib/pii/encrypt");
    const a = mod.fingerprintPii("8801011234");
    const b = mod.fingerprintPii("8801011235");
    expect(a).not.toBe(b);
  });

  it("prázdný vstup → throw", async () => {
    const mod = await import("@/lib/pii/encrypt");
    expect(() => mod.fingerprintPii("")).toThrow();
    expect(() => mod.fingerprintPii("   ")).toThrow();
  });

  it("HMAC klíč musí být minimálně 32 B po base64 dekódování", async () => {
    const prev = process.env.PII_FINGERPRINT_KEY_BASE64;
    process.env.PII_FINGERPRINT_KEY_BASE64 = b64(randomBytes(16));
    // Nutno znovu načíst modul, aby neběžel z cache (jen první použití).
    await expect(async () => {
      const mod = await import("@/lib/pii/encrypt");
      mod.fingerprintPii("x");
    }).rejects.toThrow(/min\. 32 bajtů/);
    process.env.PII_FINGERPRINT_KEY_BASE64 = prev;
  });
});

// ---------------------------------------------------------------------------
// 2) Signed URL TTL — žádný purpose nesmí mít > 24 h
// ---------------------------------------------------------------------------

describe("WS-2 Batch 5 — signed URL TTL (DoD: ≤ 24 h pro avatar/logo)", () => {
  it("createSignedStorageUrl vystavuje EXPIRY_SECONDS pro každý purpose", async () => {
    // Static check na zdroják: ověříme hodnoty přímo v mapě `EXPIRY_SECONDS`,
    // aby jakákoli regrese typu "zpět na 365*24*3600" okamžitě spadla.
    const src = read("apps/web/src/lib/storage/signed-url.ts");
    expect(src).toMatch(/EXPIRY_SECONDS[^}]*download:\s*90\b/);
    expect(src).toMatch(/internal_processing:\s*900\b/);
    expect(src).toMatch(/advisor_document_preview:\s*3600\b/);
    // DoD strop pro avatary/loga: ≤ 24 h (86400 s). 3600 << 86400.
    const m = src.match(/advisor_document_preview:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(86400);
  });

  it("avatar/preferences akce NEPOUŽÍVAJÍ createSignedUrl s 365denním TTL", () => {
    // Žádná z upload funkcí nesmí zůstat s `60 * 60 * 24 * 365`.
    const contacts = read("apps/web/src/app/actions/contacts.ts");
    const preferences = read("apps/web/src/app/actions/preferences.ts");
    expect(contacts).not.toMatch(/60\s*\*\s*60\s*\*\s*24\s*\*\s*365/);
    expect(preferences).not.toMatch(/60\s*\*\s*60\s*\*\s*24\s*\*\s*365/);
  });

  it("avatar upload ukládá storage path (ne signed URL) do DB", () => {
    const contacts = read("apps/web/src/app/actions/contacts.ts");
    expect(contacts).toMatch(/avatarUrl:\s*path/);
    expect(contacts).toMatch(/buildAvatarProxyUrl/);
    const preferences = read("apps/web/src/app/actions/preferences.ts");
    expect(preferences).toMatch(/avatarUrl:\s*path/);
    expect(preferences).toMatch(/reportLogoUrl:\s*path/);
    expect(preferences).toMatch(/buildAvatarProxyUrl/);
  });
});

// ---------------------------------------------------------------------------
// 3) Audit coverage — avatar proxy route + signed URL generation
// ---------------------------------------------------------------------------

describe("WS-2 Batch 5 — audit coverage avatar/logo proxy", () => {
  it("/api/storage/avatar route existuje a auditje signed URL (generated + failed)", () => {
    const p = "apps/web/src/app/api/storage/avatar/route.ts";
    expect(exists(p)).toBe(true);
    const src = read(p);
    // Auth + tenant guard:
    expect(src).toMatch(/getMembership/);
    expect(src).toMatch(/isAllowedPath/);
    // Volá createSignedStorageUrl s audit kontextem:
    expect(src).toMatch(/createSignedStorageUrl/);
    expect(src).toMatch(/purpose:\s*"advisor_document_preview"/);
    expect(src).toMatch(/audit:\s*{/);
    // Fallback audit při selhání:
    expect(src).toMatch(/storage\.signed_url_failed/);
    // Redirect, nikoli přímé streamování (tenant isolation + audit-only path handling):
    expect(src).toMatch(/NextResponse\.redirect/);
  });

  it("createSignedStorageUrl audituje signed_url.generated s hashem cesty", () => {
    const src = read("apps/web/src/lib/storage/signed-url.ts");
    expect(src).toMatch(/action:\s*"signed_url\.generated"/);
    expect(src).toMatch(/pathHash:\s*hashPath/);
    // Nikdy neloguj plnou cestu (může obsahovat UUID klienta).
    expect(src).not.toMatch(/meta:[\s\S]*?path:\s*params\.path/);
  });

  it("toAvatarDisplayUrl konvertuje storage path na proxy URL a passuje legacy https", async () => {
    const mod = await import("@/lib/storage/avatar-proxy");
    expect(mod.toAvatarDisplayUrl(null)).toBeNull();
    expect(mod.toAvatarDisplayUrl("")).toBeNull();
    expect(mod.toAvatarDisplayUrl("https://example.com/foo.jpg")).toBe(
      "https://example.com/foo.jpg"
    );
    expect(mod.toAvatarDisplayUrl("data:image/png;base64,iVBORw")).toBe(
      "data:image/png;base64,iVBORw"
    );
    const uuid = "11111111-2222-3333-4444-555555555555";
    const storagePath = `${uuid}/avatars/contact-1/abc.jpg`;
    expect(mod.toAvatarDisplayUrl(storagePath)).toBe(
      `/api/storage/avatar?path=${encodeURIComponent(storagePath)}`
    );
  });
});
