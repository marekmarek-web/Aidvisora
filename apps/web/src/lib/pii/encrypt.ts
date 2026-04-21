import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * PII šifrování (skeleton pro WS-2 Batch 1).
 *
 * Proč aplikační AES-GCM a ne pgsodium/Vault TCE:
 * - Supabase Transparent Column Encryption (pgsodium) je deprecated; `pgsodium`
 *   není v projektu nainstalován a aktivace se nedoporučuje.
 * - `supabase_vault` 0.3.1 je dostupný pro uložení secretů (nikoli pro sloupcové šifrování).
 * - `pgcrypto` 1.3 je k dispozici, ale klíč by musel existovat v session → nechceme.
 *
 * Tato vrstva **zatím nenapojuje šifrování na žádný sloupec**. Je to skeleton pro
 * Batch 2 backfill. Úkolem Batch 1 je jen připravit util, který je:
 *   - fail-fast při chybějícím klíči,
 *   - kompatibilní s rotací klíče (key_id v envelope),
 *   - bez závislostí mimo `node:crypto`.
 *
 * Interní bezpečnostní util pro poradce-SaaS nástroj Aidvisora. Ne rada klientovi.
 */

const ALG = "aes-256-gcm" as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENVELOPE_VERSION = "v1" as const;

type KeyMaterial = {
  keyId: string;
  key: Buffer;
};

let cachedPrimaryKey: KeyMaterial | null = null;
let cachedSecondaryKeys: KeyMaterial[] | null = null;

function decodeKey(b64: string, label: string): Buffer {
  if (!b64) {
    throw new Error(`${label}: prázdný klíč.`);
  }
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) {
    throw new Error(`${label}: očekávám 32 bajtů po base64 dekódování (AES-256), dostal ${buf.length}.`);
  }
  return buf;
}

/** Načte aktivní (primární) šifrovací klíč z env. Lazy + memoized. */
function getPrimaryKey(): KeyMaterial {
  if (cachedPrimaryKey) return cachedPrimaryKey;
  const b64 = process.env.PII_ENCRYPTION_KEY_BASE64 ?? "";
  const keyId = process.env.PII_ENCRYPTION_KEY_ID ?? "k1";
  const key = decodeKey(b64, "PII_ENCRYPTION_KEY_BASE64");
  cachedPrimaryKey = { keyId, key };
  return cachedPrimaryKey;
}

/**
 * Načte sekundární klíče pro rotaci, formát:
 *   PII_ENCRYPTION_KEYS=<id1>:<base64>,<id2>:<base64>
 * Slouží pro dešifrování legacy řádků, nikoli pro nové šifrování.
 */
function getSecondaryKeys(): KeyMaterial[] {
  if (cachedSecondaryKeys) return cachedSecondaryKeys;
  const raw = process.env.PII_ENCRYPTION_KEYS ?? "";
  if (!raw) {
    cachedSecondaryKeys = [];
    return cachedSecondaryKeys;
  }
  cachedSecondaryKeys = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, b64] = entry.split(":");
      if (!id || !b64) {
        throw new Error("PII_ENCRYPTION_KEYS: očekávaný formát '<key_id>:<base64>,<key_id>:<base64>'.");
      }
      return { keyId: id, key: decodeKey(b64, `PII_ENCRYPTION_KEYS[${id}]`) };
    });
  return cachedSecondaryKeys;
}

function findKey(keyId: string): Buffer {
  const primary = getPrimaryKey();
  if (keyId === primary.keyId) return primary.key;
  const secondary = getSecondaryKeys().find((k) => k.keyId === keyId);
  if (!secondary) {
    throw new Error(`PII decrypt: neznámý key_id ${JSON.stringify(keyId)}.`);
  }
  return secondary.key;
}

/**
 * Envelope formát výstupu:
 *   <version>.<key_id>.<base64url(iv)>.<base64url(ciphertext)>.<base64url(tag)>
 * Oddělovače '.' jsou base64url-safe ⇒ parsování je jednoduché.
 */
function toB64Url(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromB64Url(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replaceAll("-", "+").replaceAll("_", "/") + pad, "base64");
}

/**
 * Šifruje UTF-8 plaintext primárním klíčem, vrací envelope string.
 * `associatedData` (volitelné) je svázáno s ciphertextem přes GCM AAD
 * (doporučeno předávat např. `tenantId:columnName`, aby se zabránilo přesouvání
 * ciphertextu mezi tenanty / sloupci).
 */
export function encryptPii(plaintext: string, associatedData?: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("encryptPii: plaintext musí být string.");
  }
  const { keyId, key } = getPrimaryKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  if (associatedData) {
    cipher.setAAD(Buffer.from(associatedData, "utf8"));
  }
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_VERSION, keyId, toB64Url(iv), toB64Url(enc), toB64Url(tag)].join(".");
}

export function decryptPii(envelope: string, associatedData?: string): string {
  if (typeof envelope !== "string" || envelope.length === 0) {
    throw new Error("decryptPii: prázdný envelope.");
  }
  const parts = envelope.split(".");
  if (parts.length !== 5) {
    throw new Error("decryptPii: neplatný envelope (očekáváno 5 segmentů).");
  }
  const [version, keyId, ivB64, ctB64, tagB64] = parts;
  if (version !== ENVELOPE_VERSION) {
    throw new Error(`decryptPii: nepodporovaná verze envelope ${JSON.stringify(version)}.`);
  }
  const key = findKey(keyId);
  const iv = fromB64Url(ivB64);
  const ct = fromB64Url(ctB64);
  const tag = fromB64Url(tagB64);
  if (iv.length !== IV_BYTES) throw new Error("decryptPii: neplatný IV.");
  if (tag.length !== TAG_BYTES) throw new Error("decryptPii: neplatný auth tag.");
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  if (associatedData) {
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
  }
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString("utf8");
}

/** Bezpečné porovnání dvou envelope stringů (constant-time přes bytes). */
export function envelopeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Deterministický HMAC-SHA256 fingerprint pro equality lookup nad šifrovaným sloupcem.
 *
 * Proč samostatný klíč: `PII_FINGERPRINT_KEY_BASE64`. Nikdy nepoužívej šifrovací klíč
 * jako HMAC klíč — rotace by znehodnotila všechny indexy.
 *
 * Použití (dual-column pattern pro `contacts.personal_id` / `id_card_number`):
 *   - write: `UPDATE contacts SET personal_id_enc = encryptPii(rc, 'contact:personal_id'),
 *                                   personal_id_fp = fingerprintPii(rc)`
 *   - lookup: `SELECT id FROM contacts WHERE personal_id_fp = fingerprintPii(inputRc)`
 *   - read:  `decryptPii(row.personal_id_enc, 'contact:personal_id')`
 *
 * Normalizace vstupu: odstraní bílé znaky a uvede na lowercase; identická PII s
 * různým formátováním ("123456/7890" vs "1234567890") tak dá stejný fingerprint.
 * Vrací base64url bez paddingu (43 znaků) — bezpečné pro `text` sloupec a URL.
 */
export function fingerprintPii(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("fingerprintPii: plaintext musí být string.");
  }
  const normalized = plaintext.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  if (normalized.length === 0) {
    throw new Error("fingerprintPii: prázdný vstup po normalizaci.");
  }
  const keyB64 = process.env.PII_FINGERPRINT_KEY_BASE64 ?? "";
  if (!keyB64) {
    throw new Error("fingerprintPii: chybí PII_FINGERPRINT_KEY_BASE64.");
  }
  const key = Buffer.from(keyB64, "base64");
  if (key.length < 32) {
    throw new Error("fingerprintPii: klíč musí být min. 32 bajtů po base64 dekódování.");
  }
  const mac = createHmac("sha256", key).update(normalized, "utf8").digest();
  return toB64Url(mac);
}

/** Deterministický smoke test (spustitelný přes jednorázový script), ne production hot-path. */
export function __pii_self_test(): boolean {
  const sample = "test-pii-" + new Date().toISOString();
  const env = encryptPii(sample, "self-test");
  const back = decryptPii(env, "self-test");
  return back === sample;
}

export const __internal_for_tests = { getPrimaryKey, getSecondaryKeys };
