import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Podmínky beta / pilotního programu · Aidvisora",
  description:
    "Podmínky účasti v pilotním programu Aidvisora (Premium Brokers pilot). Informace o stavu produktu, SLA, datech a ochraně.",
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function BetaTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[color:var(--wp-text)]">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Pilotní program · Premium Brokers
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight">
          Podmínky účasti v beta / pilotním programu Aidvisory
        </h1>
        <p className="mt-3 text-sm text-[color:var(--wp-text-secondary)]">
          Verze 1 · platnost od 21.&nbsp;4.&nbsp;2026
        </p>
      </header>

      <section className="space-y-8 text-[15px] leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-black">1. Účel tohoto dokumentu</h2>
          <p>
            Aidvisora je ve fázi produktového startu. Pro uzavřenou skupinu
            partnerů (dále jen „Pilotní program“) poskytujeme přístup za
            zvýhodněných podmínek výměnou za rychlou zpětnou vazbu, reálné
            nasazení a toleranci k drobným produktovým změnám.
          </p>
          <p className="mt-2">
            Tyto podmínky doplňují <Link href="/vop" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">Všeobecné obchodní podmínky</Link>,{" "}
            <Link href="/privacy" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">Zásady ochrany osobních údajů</Link> a{" "}
            <Link href="/dpa" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">Smlouvu o zpracování osobních údajů (DPA)</Link>.
            Při konfliktu má přednost konkrétní ujednání v Pilotním programu,
            jinak platí VOP a DPA.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-black">2. Stav produktu a očekávání</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Aidvisora je produkční aplikace, ale některé moduly jsou stále
              v aktivním vývoji (zejména AI review, výpovědní registr,
              pokročilé reporty). Chování těchto modulů se může v rámci pilotu
              bez předchozího upozornění měnit.
            </li>
            <li>
              Účastníci pilotu budou prvními uživateli nových funkcí ještě
              před veřejným vydáním.
            </li>
            <li>
              Změny uživatelského rozhraní a datového modelu budou dopředu
              oznámeny e-mailem nebo přímo v aplikaci. Pokud migrace vyžaduje
              jednorázovou součinnost (např. doplnění údaje), bude to jasně
              vyznačené.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-black">3. Dostupnost a SLA</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              V průběhu pilotu neposkytujeme smluvní SLA jako u standardní
              placené smlouvy. Cílíme na{" "}
              <strong>dostupnost ≥ 99,5 % měsíčně</strong> a reakci na
              <em> P0 výpadek</em> do 30 minut v pracovních dnech 8–20 hod.
            </li>
            <li>
              Statuspage a eskalační kontakty jsou uvedené v pozvánce do pilotu
              a v e-mailu účastníka.
            </li>
            <li>
              Plánované údržby (migrace, větší deploye) se snažíme dělat mimo
              špičku (08:00–18:00 v&nbsp;pracovních dnech) a oznámit je
              v aplikaci alespoň 24&nbsp;h předem.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-black">4. Data, zálohy, přenositelnost</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Data v pilotu jsou <strong>ostrá</strong>. Z pohledu ochrany
              osobních údajů (GDPR) platí shodný režim jako pro placené
              zákazníky — jsme zpracovatelem dle{" "}
              <Link href="/dpa" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">DPA</Link>.
            </li>
            <li>
              Zálohy DB běží automaticky u našeho poskytovatele (Supabase) —
              retenci a frekvenci najdete v{" "}
              <Link href="/privacy" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">Zásadách ochrany osobních údajů</Link>.
            </li>
            <li>
              Kdykoli v průběhu pilotu i po jeho skončení lze požádat
              o <strong>export dat</strong> (kontakty, smlouvy, dokumenty,
              aktivity) strojově čitelném formátu. Export dodáme do 7
              pracovních dnů od žádosti přes{" "}
              <a
                href="mailto:support@aidvisora.cz"
                className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                support@aidvisora.cz
              </a>.
            </li>
            <li>
              Při ukončení účasti v pilotu smažeme osobní údaje do 60 dnů,
              pokud zákon nevyžaduje jejich delší uchování.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-black">5. AI funkce a jejich limity</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              AI výstupy (např. AI review smluv, návrhy textů, shrnutí) jsou
              pouze <strong>doporučujícího charakteru</strong>. Odpovědnost za
              kontrolu výstupů vůči klientovi a za finální rozhodnutí (např.
              doporučení změny produktu, výpověď smlouvy, podání žádosti) nese
              pojišťovací zprostředkovatel.
            </li>
            <li>
              Vstupy do AI procesů (např. PDF smluv) mohou být odesílány
              poskytovatelům LLM služeb dle{" "}
              <a
                href="/docs/GDPR-AI"
                className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                GDPR-AI policy
              </a>.
              Všechny tyto toky jsou pseudonymizované na úrovni PII a logované.
            </li>
            <li>
              Pokud se účastník rozhodne do AI review nahrávat dokumenty
              3.&nbsp;osob, musí mít k tomu právní titul (souhlas klienta nebo
              jiný zákonný důvod).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-black">6. Cena a platby v pilotu</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Pilotní účastníci mohou obdržet{" "}
              <strong>zvýhodněnou cenu</strong> prostřednictvím promo kódu
              (např. <code className="rounded bg-[color:var(--wp-surface-muted)] px-1 text-xs">PREMIUM-BROKERS-2026</code>).
              Přesná částka, délka slevy a případný trial jsou uvedeny v pozvánce
              a ve Stripe Checkoutu.
            </li>
            <li>
              Platby probíhají přes Stripe; faktury vystavuje Aidvisora s.r.o.
              na základě fakturačních údajů zadaných během checkoutu.
            </li>
            <li>
              Pilotní účast lze kdykoliv ukončit přes Stripe Customer Portal
              („Spravovat platby a faktury“). Smazání účtu se řídí{" "}
              <Link href="/vop" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">VOP</Link>.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-black">7. Zpětná vazba a reference</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Účastník souhlasí s tím, že může být požádán o stručnou
              zpětnou vazbu (po telefonu, e-mailem, ve schůzce) k používaným
              modulům. Účast je dobrovolná.
            </li>
            <li>
              Jméno / logo účastníka můžeme uvést jako referenci pouze po
              jeho <strong>výslovném písemném souhlasu</strong>. Samotná účast
              v pilotu k tomu neopravňuje.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-black">8. Kontakt a eskalace</h2>
          <p>
            Obecný support:{" "}
            <a
              href="mailto:support@aidvisora.cz"
              className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              support@aidvisora.cz
            </a>
            <br />
            Bezpečnostní incidenty (suspected data breach, ztráta přístupu,
            phishing na vaše uživatele):{" "}
            <a
              href="mailto:bezpecnost@aidvisora.cz"
              className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              bezpecnost@aidvisora.cz
            </a>
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-black">9. Akceptace</h2>
          <p>
            Účastník Pilotního programu potvrzuje tyto podmínky v okamžiku
            zahájení předplatného (checkbox v checkoutu) a/nebo prvním
            přihlášením po obdržení pozvánky. Potvrzení je logované v{" "}
            <code className="rounded bg-[color:var(--wp-surface-muted)] px-1 text-xs">
              billing_audit_log
            </code>{" "}
            (metadata <code className="rounded bg-[color:var(--wp-surface-muted)] px-1 text-xs">betaTermsAcked</code>).
          </p>
        </div>
      </section>

      <footer className="mt-12 flex items-center justify-between border-t border-[color:var(--wp-surface-card-border)] pt-6 text-sm text-[color:var(--wp-text-secondary)]">
        <Link href="/" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
          ← Zpět na hlavní stránku
        </Link>
        <span>© Aidvisora s.r.o.</span>
      </footer>
    </main>
  );
}
