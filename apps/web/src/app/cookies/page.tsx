import type { Metadata } from "next";
import cookiesBlocks from "@/app/legal/content/cookies-blocks.json";
import type { LegalBlock } from "@/app/legal/LegalBlocks";
import { LegalBlocks } from "@/app/legal/LegalBlocks";
import { LegalDocumentLayout } from "@/app/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_CS } from "@/app/legal/legal-meta";

export const metadata: Metadata = {
  title: "Cookies | Aidvisora",
  description: `Přehled cookies a podobných technologií, které Aidvisora používá. Essential-only režim; analytické ani marketingové cookies bez souhlasu nenasazujeme. Účinnost od ${LEGAL_EFFECTIVE_CS}.`,
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: true },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function CookiesPage() {
  const blocks = cookiesBlocks as LegalBlock[];

  return (
    <LegalDocumentLayout title="Cookies a podobné technologie" documentSlug="cookies">
      <LegalBlocks blocks={blocks} />
    </LegalDocumentLayout>
  );
}
