import "server-only";

import { decryptPii } from "./encrypt";

/**
 * WS-2 Batch 5 — read-through helper pro PII pole na `contacts`.
 *
 * Používá se tam, kde server musí vrátit plaintext PII pro editaci / zobrazení
 * poradci (Advisor/Admin) nebo pro AI review prefill:
 *
 *   const rc = decryptContactPii(row.personalIdEnc, row.personalId, "contact:personal_id");
 *
 * Smlouva:
 *   - Pokud `encEnvelope` existuje → dešifruj (AAD musí odpovídat sloupci).
 *   - Pokud dešifrování selže → spadne do fallbacku plaintextu + emit warning
 *     (fallback je zachován pro přechodné období po migraci / backfillu).
 *   - Pokud obě chybí → `null`.
 *
 * **NIKDY** volat z klientského bundlu. `server-only` zajišťuje build-time fail.
 */
export function decryptContactPii(
  encEnvelope: string | null | undefined,
  plaintextFallback: string | null | undefined,
  aad: "contact:personal_id" | "contact:id_card_number",
): string | null {
  if (encEnvelope && encEnvelope.length > 0) {
    try {
      return decryptPii(encEnvelope, aad);
    } catch (err) {
      // Nefatální: loguj a spadni na plaintext fallback. Záměrně nelogujeme hodnotu.
      console.warn(`[pii-read] decrypt failed for ${aad}`, {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const plain = plaintextFallback?.trim();
  return plain && plain.length > 0 ? plain : null;
}

/** Typový alias pro výběr z contacts (server-side); držíme nominální strukturu. */
export type ContactPiiRow = {
  personalId?: string | null;
  personalIdEnc?: string | null;
  idCardNumber?: string | null;
  idCardNumberEnc?: string | null;
};

/**
 * Rozšifruje obě PII pole naráz. Vrací nový objekt `{ personalId, idCardNumber }`
 * v plaintextu (nebo `null`), ostatní pole nevrací — volající si je přebere sám.
 */
export function decryptContactPiiPair(row: ContactPiiRow): {
  personalId: string | null;
  idCardNumber: string | null;
} {
  return {
    personalId: decryptContactPii(row.personalIdEnc, row.personalId, "contact:personal_id"),
    idCardNumber: decryptContactPii(
      row.idCardNumberEnc,
      row.idCardNumber,
      "contact:id_card_number",
    ),
  };
}
