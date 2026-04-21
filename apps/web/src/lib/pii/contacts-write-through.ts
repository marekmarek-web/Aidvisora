import "server-only";

import { encryptPii, fingerprintPii } from "./encrypt";

/**
 * WS-2 Batch 5 — write-through pro `contacts.personal_id` a `contacts.id_card_number`.
 *
 * Použití v server action / API route při zápisu kontaktu (insert/update):
 *
 *   const piiPatch = buildContactsPiiPatch({
 *     personalId: input.personalId ?? null,
 *     idCardNumber: input.idCardNumber ?? null,
 *   });
 *   await tx.update(contacts).set({ ...input, ...piiPatch }).where(...);
 *
 * Pravidla:
 *   - Pokud PII pole není v inputu (undefined), nevracíme odpovídající `_enc/_fp` páry
 *     → existující šifrovaný záznam zůstane.
 *   - Pokud je PII pole `null` nebo prázdný string, `_enc/_fp` páry jsou vynulovány.
 *   - Pokud je PII pole string, `_enc` obsahuje envelope a `_fp` deterministický HMAC.
 *
 * Interní bezpečnostní vrstva pro Aidvisora CRM. Žádná z funkcí nevrací PII v plain textu.
 */

export type ContactsPiiInput = {
  personalId?: string | null | undefined;
  idCardNumber?: string | null | undefined;
};

export type ContactsPiiPatch = {
  personalId?: string | null;
  personalIdEnc?: string | null;
  personalIdFingerprint?: string | null;
  idCardNumber?: string | null;
  idCardNumberEnc?: string | null;
  idCardNumberFingerprint?: string | null;
};

function normalizeForStorage(value: string): string {
  return value.trim();
}

function encodePii(
  value: string | null | undefined,
  plaintextKey: "personalId" | "idCardNumber",
  encKey: "personalIdEnc" | "idCardNumberEnc",
  fpKey: "personalIdFingerprint" | "idCardNumberFingerprint",
  aad: string,
): Partial<ContactsPiiPatch> {
  if (value === undefined) return {};
  if (value === null || value.trim().length === 0) {
    return {
      [plaintextKey]: null,
      [encKey]: null,
      [fpKey]: null,
    } as Partial<ContactsPiiPatch>;
  }
  const normalized = normalizeForStorage(value);
  const enc = encryptPii(normalized, aad);
  const fp = fingerprintPii(normalized);
  return {
    [plaintextKey]: normalized,
    [encKey]: enc,
    [fpKey]: fp,
  } as Partial<ContactsPiiPatch>;
}

/**
 * Sestaví patch objekt pro `contacts` UPDATE/INSERT. Pracuje v dual-column módu:
 * plaintext sloupec zůstává pro zpětnou kompatibilitu dokud nedojde k úplnému
 * backfillu + drop plaintextu v pozdější migraci.
 *
 * **Důležité:** nevolat s `undefined` → undefined znamená "nech tak, jak je", tedy
 * nevracíme žádnou property → stávající hodnoty (plaintext i šifrované) zůstávají.
 */
export function buildContactsPiiPatch(input: ContactsPiiInput): ContactsPiiPatch {
  return {
    ...encodePii(
      input.personalId,
      "personalId",
      "personalIdEnc",
      "personalIdFingerprint",
      "contact:personal_id",
    ),
    ...encodePii(
      input.idCardNumber,
      "idCardNumber",
      "idCardNumberEnc",
      "idCardNumberFingerprint",
      "contact:id_card_number",
    ),
  };
}
