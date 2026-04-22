import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClientZoneAuth } from "@/lib/auth/require-auth";
import { getClientPortfolioForContact } from "@/app/actions/contracts";
import { getClientVisiblePortfolioDocumentNames } from "@/app/actions/documents";
import { buildPortalFvContractAuxMap } from "@/lib/client-portfolio/portal-portfolio-fv-precompute";
import { PortfolioPageContent } from "../PortfolioPageContent";

/**
 * B3.3 — Detail jedné smlouvy v klientském portfolio přístupný přes URL.
 *
 * Notifikace (viz `portal-notification-routing.ts`) směrují klienta na
 * `/client/portfolio/<contractId>`. Bez této stránky by tyto deep linky padaly
 * na 404 a klient by se z notifikace dostal maximálně na generický seznam.
 *
 * Implementace znovupoužívá `PortfolioPageContent` — předává jen vyfiltrovanou
 * smlouvu. Revalidation: parent layout používá `revalidateTag(contact:<id>)`
 * po update smluv (viz B1.8 — `updateContract`).
 */
export default async function ClientPortfolioContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const auth = await requireClientZoneAuth();
  if (!auth.contactId) return null;
  const { contractId } = await params;

  const contracts = await getClientPortfolioForContact(auth.contactId);
  const target = contracts.find((c) => c.id === contractId);
  if (!target) return notFound();

  const sourceDocIds = target.sourceDocumentId ? [target.sourceDocumentId] : [];
  const visibleSourceDocs =
    sourceDocIds.length > 0
      ? await getClientVisiblePortfolioDocumentNames(auth.contactId, sourceDocIds)
      : {};
  const fvContractAux = buildPortalFvContractAuxMap([target]);

  return (
    <div className="space-y-4">
      <Link
        href="/client/portfolio"
        className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline"
      >
        <ArrowLeft size={14} />
        Zpět na portfolio
      </Link>
      <PortfolioPageContent
        contracts={[target]}
        visibleSourceDocs={visibleSourceDocs}
        fvContractAux={fvContractAux}
      />
    </div>
  );
}
