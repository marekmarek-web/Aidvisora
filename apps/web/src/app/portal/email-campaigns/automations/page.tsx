import Link from "next/link";
import {
  listAutomationRules,
  getAutomationStats,
} from "@/app/actions/email-automations";
import { getEmailTemplatesAction } from "@/app/actions/email-templates";
import AutomationsClient from "./AutomationsClient";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  let rules: Awaited<ReturnType<typeof listAutomationRules>> = [];
  let stats: Awaited<ReturnType<typeof getAutomationStats>> = [];
  let templates: Awaited<ReturnType<typeof getEmailTemplatesAction>> = [];
  let forbidden = false;
  try {
    const [r, s, t] = await Promise.all([
      listAutomationRules(),
      getAutomationStats(),
      getEmailTemplatesAction(),
    ]);
    rules = r;
    stats = s;
    templates = t;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("oprávnění") || msg.includes("Nemáte")) forbidden = true;
  }

  if (forbidden) {
    return (
      <div className="p-4 md:p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Automatizace jsou dostupné uživatelům s oprávněním ke kontaktům.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/portal/email-campaigns"
            className="text-xs font-bold text-[color:var(--wp-text-tertiary)] hover:text-[color:var(--wp-text)]"
          >
            ← Zpět na kampaně
          </Link>
          <h1 className="mt-2 text-2xl font-black text-[color:var(--wp-text)]">
            E-mailové automatizace
          </h1>
          <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">
            Pravidla, která se automaticky spouští každý den v 8:00 — narozeniny klientů,
            neaktivní kontakty, roční přehledy a další.
          </p>
        </div>
      </div>
      <AutomationsClient initialRules={rules} initialStats={stats} templates={templates} />
    </div>
  );
}
