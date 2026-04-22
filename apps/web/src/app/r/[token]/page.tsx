import { notFound } from "next/navigation";
import {
  resolveReferralByToken,
  markReferralOpened,
} from "@/lib/referrals/public";
import ReferralFormClient from "./ReferralFormClient";

export const dynamic = "force-dynamic";

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await resolveReferralByToken(token);
  if (!ctx) return notFound();

  await markReferralOpened(token);

  const whoName =
    `${ctx.contactFirstName ?? ""} ${ctx.contactLastName ?? ""}`.trim() || "vaši známí";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <div className="mb-8 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
            {ctx.tenantName}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[color:var(--wp-text)] md:text-4xl">
            Doporučení od {whoName}
          </h1>
          <p className="mt-3 text-sm text-[color:var(--wp-text-secondary)] md:text-base">
            Dobrý den, {whoName} Vás doporučil/a jako někoho, komu by se mohla hodit finanční
            konzultace. Pokud máte zájem, zanechte nám na sebe kontakt — ozveme se Vám v řádu dnů.
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-white p-6 shadow-sm md:p-8">
          {ctx.isSubmitted ? (
            <SuccessBanner />
          ) : ctx.isExpired ? (
            <ExpiredBanner />
          ) : (
            <ReferralFormClient token={token} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[color:var(--wp-text-tertiary)]">
          Zpracování osobních údajů proběhne pouze pro účel kontaktování a uzavření případné
          spolupráce. Kdykoliv můžete žádat o jejich výmaz.
        </p>
      </div>
    </div>
  );
}

function SuccessBanner() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
        ✓
      </div>
      <h2 className="text-xl font-black text-[color:var(--wp-text)]">
        Děkujeme za doporučení!
      </h2>
      <p className="mt-2 text-sm text-[color:var(--wp-text-secondary)]">
        Brzy Vás bude kontaktovat poradce — obvykle do 2 pracovních dnů.
      </p>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-black text-[color:var(--wp-text)]">
        Odkaz vypršel
      </h2>
      <p className="mt-2 text-sm text-[color:var(--wp-text-secondary)]">
        Tento odkaz již není aktivní. Kontaktujte přímo poradce, který Vám ho zaslal.
      </p>
    </div>
  );
}
