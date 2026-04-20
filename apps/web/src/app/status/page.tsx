import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BellRing, History, Mail, ShieldAlert } from "lucide-react";
import {
  LEGAL_EFFECTIVE_CS,
  LEGAL_SECURITY_EMAIL,
  LEGAL_STATUS_PAGE_URL,
  LEGAL_SUPPORT_EMAIL,
} from "@/app/legal/legal-meta";

export const metadata: Metadata = {
  title: "Provozní stav | Aidvisora",
  description:
    "Provozní stav platformy Aidvisora, plánované odstávky, historie incidentů a kontaktní informace pro hlášení. Public status page se připravuje.",
  alternates: { canonical: "/status" },
  robots: { index: true, follow: true },
};

type InfoCardProps = {
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
};

function InfoCard({ icon: Icon, title, description }: InfoCardProps) {
  return (
    <div className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
        <Icon size={20} aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{description}</p>
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:py-14">
      <header className="border-b border-gray-200 pb-8 dark:border-gray-700">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Aktuální k {LEGAL_EFFECTIVE_CS}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          Provozní stav
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          Aidvisora je v controlled beta režimu s Premium Brokers. Veřejná status page je v přípravě
          a bude dostupná na externí doméně po spuštění monitorovacího stacku (Sentry alerting,
          uptime monitoring, public incident feed).
        </p>
      </header>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoCard
          icon={Activity}
          title="Aktuální stav platformy"
          description="Pokud portál nebo klientská zóna nejsou dostupné, ověřte to prosím v jiném prohlížeči nebo po restartu routeru. Incidenty na naší straně hlásíme registrovaným uživatelům e-mailem a po spuštění status page také veřejně."
        />
        <InfoCard
          icon={History}
          title="Historie incidentů"
          description="Zásadní incidenty (delší než 30 minut, degradace jádra CRM, ztráta dat, bezpečnostní události) budou historicky dokumentovány se souhrnem a nápravnými opatřeními. Do spuštění public status page poskytneme souhrn na vyžádání."
        />
        <InfoCard
          icon={BellRing}
          title="Plánované odstávky"
          description="Pravidelná údržba je nastavena mimo špičku (typicky v noci nebo o víkendech). O plánované odstávce delší než 15 minut informujeme s předstihem uvnitř portálu a e-mailem admin kontaktům workspace."
        />
        <InfoCard
          icon={ShieldAlert}
          title="Bezpečnostní incidenty"
          description="Pokud máte podezření na únik dat, kompromitaci účtu, phishing nebo zranitelnost, nahlaste to prosím přednostně na níže uvedený kanál. Reagujeme na reporty v režimu odpovědného zveřejnění."
        />
      </section>

      <section className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-500/30 dark:bg-blue-950/30">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          Veřejná status page
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-blue-900/90 dark:text-blue-100/90">
          Připravujeme externí public status page s monitorováním klíčových komponent (portál,
          klientská zóna, AI pipeline, platební integrace). Cílový endpoint:
        </p>
        <p className="mt-3 break-all font-mono text-sm text-blue-900 dark:text-blue-100">
          {LEGAL_STATUS_PAGE_URL}
        </p>
        <a
          href={LEGAL_STATUS_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Otevřít status page (v přípravě)
        </a>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kontakty pro provozní záležitosti</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
              <Mail size={18} aria-hidden />
              <span className="text-sm font-semibold">Provozní dotazy</span>
            </div>
            <a
              className="mt-2 inline-block break-all text-sm font-medium text-blue-600 underline dark:text-blue-400"
              href={`mailto:${LEGAL_SUPPORT_EMAIL}?subject=${encodeURIComponent("Provozní dotaz")}`}
            >
              {LEGAL_SUPPORT_EMAIL}
            </a>
          </div>
          <div className="rounded-xl border border-amber-300/40 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <ShieldAlert size={18} aria-hidden />
              <span className="text-sm font-semibold">Bezpečnostní incident / zranitelnost</span>
            </div>
            <a
              className="mt-2 inline-block break-all text-sm font-medium text-amber-900 underline dark:text-amber-100"
              href={`mailto:${LEGAL_SECURITY_EMAIL}?subject=${encodeURIComponent("Bezpečnostní incident")}`}
            >
              {LEGAL_SECURITY_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <nav
        className="mt-12 border-t border-gray-200 pt-8 dark:border-gray-700"
        aria-label="Související stránky"
      >
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Související stránky</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-4">
          <li>
            <Link href="/bezpecnost" className="min-h-[44px] inline-flex items-center text-blue-600 underline dark:text-blue-400">
              Bezpečnost a ochrana dat
            </Link>
          </li>
          <li>
            <Link href="/kontakt" className="min-h-[44px] inline-flex items-center text-blue-600 underline dark:text-blue-400">
              Kontakt
            </Link>
          </li>
          <li>
            <Link href="/subprocessors" className="min-h-[44px] inline-flex items-center text-blue-600 underline dark:text-blue-400">
              Subdodavatelé
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
