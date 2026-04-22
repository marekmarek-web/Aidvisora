import { NextResponse } from "next/server";
import { withAuthContext } from "@/lib/auth/with-auth-context";
import { sql } from "db";

/**
 * GET /api/messages/health — diagnostika: existují tabulky messages a message_attachments?
 * Přístupné pouze přihlášenému uživateli (advisor nebo client).
 * Vrátí JSON s přesnými chybami, aby bylo jasné co v Supabase chybí.
 *
 * Runtime po cutoveru běží pod `aidvisora_app` s FORCE RLS na obou tabulkách;
 * proto musí probe běžet v transakci s nastaveným tenant GUC, jinak by vracela
 * 0 řádků (ne chybu) a „diagnostika“ by byla zavádějící.
 */
export async function GET() {
  let checks: Record<string, string>;
  try {
    checks = await withAuthContext(async (_auth, tx) => {
      const out: Record<string, string> = {};
      for (const table of ["messages", "message_attachments"] as const) {
        try {
          await tx.execute(sql.raw(`SELECT 1 FROM ${table} LIMIT 1`));
          out[table] = "OK";
        } catch (e) {
          out[table] = e instanceof Error ? e.message : String(e);
        }
      }
      return out;
    });
  } catch {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const allOk = Object.values(checks).every((v) => v === "OK");
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
