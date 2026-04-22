import type { Metadata } from "next";
import Link from "next/link";
import type { LegalBlock } from "@/app/legal/LegalBlocks";
import { LegalBlocks } from "@/app/legal/LegalBlocks";
import { LegalDocumentLayout } from "@/app/legal/LegalDocumentLayout";
import { LegalSubprocessorsTable } from "@/app/legal/LegalSubprocessorsTable";
import { LEGAL_EFFECTIVE_CS, LEGAL_SUPPORT_EMAIL } from "@/app/legal/legal-meta";

export const metadata: Metadata = {
  title: "Subdodavatelé | Aidvisora",
  description: `Aktuální přehled subdodavatelů (subprocessorů), kteří jsou zapojeni do poskytování služby Aidvisora, a pravidla pro jejich změny. Aktualizováno ${LEGAL_EFFECTIVE_CS}.`,
  alternates: { canonical: "/subprocessors" },
  robots: { index: true, follow: true },
};

export const dynamic = "force-static";
export const revalidate = 3600;

const INTRO: LegalBlock[] = [
  {
    type: "p",
    text: "Tato stránka obsahuje aktuální veřejný přehled subdodavatelů (subprocessorů) podle čl. 28 GDPR, kteří se podílejí na poskytování služby Aidvisora. Slouží také jako reference z dokumentu Zpracovatelská smlouva (DPA).",
  },
  {
    type: "p",
    text: "Subdodavatelé jsou smluvně vázáni k zachování úrovně ochrany dat srovnatelné s naší a jsou vybíráni podle bezpečnostních standardů, regionální dostupnosti a smluvních záruk (DPA, standardní smluvní doložky EU, certifikace typu SOC 2 / ISO 27001, pokud je dodavatel poskytuje).",
  },
];

const POST_TABLE: LegalBlock[] = [
  { type: "h1", text: "1. Jak oznamujeme změny" },
  {
    type: "p",
    text: "O plánovaném zařazení nového subdodavatele zpracovávajícího osobní údaje zákazníka informujeme s přiměřeným předstihem. Drobné aktualizace (např. změna právního subjektu poskytovatele, interní restrukturalizace dodavatele bez dopadu na ochranu dat) uveřejňujeme formou aktualizace této stránky.",
  },
  {
    type: "li",
    text: "• Standardní zveřejnění: nejméně 15 kalendářních dnů před zapojením nového subdodavatele, který reálně zpracovává osobní údaje zákazníka.",
  },
  {
    type: "li",
    text: "• Bezpečnostní nebo provozní výjimky: okamžité zapojení s následnou notifikací (typicky vynucená bezpečnostní záplata, přechod z kompromitovaného dodavatele).",
  },
  {
    type: "li",
    text: "• Enterprise zákazníci s podepsaným DPA mohou obdržet samostatnou písemnou notifikaci podle dohodnutých podmínek.",
  },
  { type: "h1", text: "2. Právo vznést námitku" },
  {
    type: "p",
    text: "Zákazník má právo vznést odůvodněnou námitku proti konkrétnímu subdodavateli v souladu s platnou DPA. Uplatňuje se písemně na právní a privacy kontakt provozovatele. Pokud námitku nelze vyřešit (např. funkčně nenahraditelný subdodavatel typu cloud hosting), je v DPA upraven postup včetně možnosti ukončení dotčené části služby.",
  },
  { type: "h1", text: "3. Mezinárodní přenosy" },
  {
    type: "p",
    text: "Primární infrastruktura Aidvisora je vedena s ohledem na region EU, podle konfigurace konkrétního projektu. U subdodavatelů, kteří data zpracovávají mimo EHP, vyžadujeme odpovídající záruky podle čl. 46 GDPR (zejména standardní smluvní doložky EU a dle potřeby doplňkové technické/organizační opatření).",
  },
  { type: "h1", text: "4. Certifikace a audit" },
  {
    type: "p",
    text: "U klíčových subdodavatelů (infrastruktura, hosting, úložiště) preferujeme dodavatele s veřejně dokumentovaným bezpečnostním programem (SOC 2 Type II, ISO/IEC 27001, HDS v případech zpracování zdravotních dat — pro Aidvisoru relevantní v omezeném rozsahu). Konkrétní certifikační stav aktuálně platný pro jednotlivé dodavatele lze doložit na vyžádání v rámci due diligence.",
  },
  { type: "h1", text: "5. Historie aktualizací" },
  {
    type: "p",
    text: "Od spuštění veřejné verze této stránky vedeme změnový záznam v repozitáři aplikace. V1.0 — výchozí verze ke dni účinnosti uvedenému v hlavičce. Další významné změny budou doplněny níže s datem a krátkým popisem.",
  },
];

export default function SubprocessorsPage() {
  return (
    <LegalDocumentLayout title="Přehled subdodavatelů (subprocessorů)" documentSlug="subprocessors">
      <LegalBlocks blocks={INTRO} />
      <LegalSubprocessorsTable />
      <LegalBlocks blocks={POST_TABLE} sectionIdPrefix="sp-" />
      <p className="mt-10 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        Dotazy ohledně subdodavatelů, požadavky na aktualizovaný výpis pro váš audit nebo námitky
        podle platné DPA směřujte na{" "}
        <a
          className="font-semibold text-blue-600 underline dark:text-blue-400"
          href={`mailto:${LEGAL_SUPPORT_EMAIL}?subject=${encodeURIComponent("Subdodavatelé / DPA")}`}
        >
          {LEGAL_SUPPORT_EMAIL}
        </a>
        . Souvisejí dokumenty: {" "}
        <Link href="/legal/zpracovatelska-smlouva" className="font-semibold text-blue-600 underline dark:text-blue-400">
          Zpracovatelská smlouva (DPA)
        </Link>
        , {" "}
        <Link href="/privacy" className="font-semibold text-blue-600 underline dark:text-blue-400">
          Zásady zpracování osobních údajů
        </Link>
        .
      </p>
    </LegalDocumentLayout>
  );
}
