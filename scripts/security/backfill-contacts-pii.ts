/**
 * WS-2 Batch 5 — backfill `contacts.personal_id_enc` / `_fingerprint`
 *                     a `contacts.id_card_number_enc` / `_fingerprint`
 * pro všechny existující řádky s plaintext PII.
 *
 * Použití (staging / production):
 *   pnpm --filter @aidvisora/web exec tsx scripts/security/backfill-contacts-pii.ts
 *
 * ENV vars (povinné):
 *   DATABASE_URL=postgres://...
 *   PII_ENCRYPTION_KEY_BASE64=<base64 32B>
 *   PII_ENCRYPTION_KEY_ID=k1
 *   PII_FINGERPRINT_KEY_BASE64=<base64 min 32B>
 *
 * Chování:
 *   - Běží v batchích 500 řádků, ORDER BY id ASC.
 *   - Idempotentní: pokud řádek má už `_enc` vyplněný (stejný plaintext), přeskočí.
 *   - Read-only krok na začátku: report kolik řádků je potřeba backfillnout.
 *   - Neodstraňuje plaintext sloupce — to dělá samostatná pozdější migrace po ověření.
 *
 * ROLLBACK:
 *   Skript jen UPDATE-uje `_enc/_fp` sloupce — nedělá destructive změny plaintextu.
 *   Rollback = NULL těchto sloupců (manual SQL).
 */

import { encryptPii, fingerprintPii } from "@/lib/pii/encrypt";
import postgres from "postgres";

type Row = {
  id: string;
  tenant_id: string;
  personal_id: string | null;
  personal_id_enc: string | null;
  id_card_number: string | null;
  id_card_number_enc: string | null;
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL není nastavena.");
  if (!process.env.PII_ENCRYPTION_KEY_BASE64) throw new Error("PII_ENCRYPTION_KEY_BASE64 chybí.");
  if (!process.env.PII_FINGERPRINT_KEY_BASE64) throw new Error("PII_FINGERPRINT_KEY_BASE64 chybí.");

  const sql = postgres(connectionString, { max: 4, prepare: false, ssl: connectionString.includes("supabase.co") ? "require" : undefined });

  try {
    const [{ total, missing_pi, missing_idc }] = await sql<
      Array<{ total: number; missing_pi: number; missing_idc: number }>
    >`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE personal_id IS NOT NULL AND personal_id_enc IS NULL)::int AS missing_pi,
        count(*) FILTER (WHERE id_card_number IS NOT NULL AND id_card_number_enc IS NULL)::int AS missing_idc
      FROM public.contacts
    `;
    console.log("contacts total:", total);
    console.log("missing personal_id_enc:", missing_pi);
    console.log("missing id_card_number_enc:", missing_idc);

    const batchSize = 500;
    let processed = 0;
    let cursor: string | null = null;

    while (true) {
      const rows: Row[] = cursor
        ? await sql<Row[]>`
            SELECT id, tenant_id::text as tenant_id, personal_id, personal_id_enc,
                   id_card_number, id_card_number_enc
            FROM public.contacts
            WHERE id > ${cursor}::uuid
              AND (
                (personal_id IS NOT NULL AND personal_id_enc IS NULL)
                OR (id_card_number IS NOT NULL AND id_card_number_enc IS NULL)
              )
            ORDER BY id ASC
            LIMIT ${batchSize}
          `
        : await sql<Row[]>`
            SELECT id, tenant_id::text as tenant_id, personal_id, personal_id_enc,
                   id_card_number, id_card_number_enc
            FROM public.contacts
            WHERE (
              (personal_id IS NOT NULL AND personal_id_enc IS NULL)
              OR (id_card_number IS NOT NULL AND id_card_number_enc IS NULL)
            )
            ORDER BY id ASC
            LIMIT ${batchSize}
          `;
      if (rows.length === 0) break;

      for (const row of rows) {
        const updates: Record<string, string | null> = {};
        if (row.personal_id && !row.personal_id_enc) {
          const value = row.personal_id.trim();
          if (value.length > 0) {
            updates.personal_id_enc = encryptPii(value, "contact:personal_id");
            updates.personal_id_fingerprint = fingerprintPii(value);
          }
        }
        if (row.id_card_number && !row.id_card_number_enc) {
          const value = row.id_card_number.trim();
          if (value.length > 0) {
            updates.id_card_number_enc = encryptPii(value, "contact:id_card_number");
            updates.id_card_number_fingerprint = fingerprintPii(value);
          }
        }
        if (Object.keys(updates).length > 0) {
          await sql`
            UPDATE public.contacts
            SET ${sql(updates)}
            WHERE id = ${row.id}::uuid
          `;
        }
        processed++;
      }
      cursor = rows[rows.length - 1].id;
      console.log(`batch done: processed=${processed} cursor=${cursor}`);
    }

    console.log(`DONE. processed=${processed}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
