import type { ContractRow } from "@/app/actions/contracts";
import type { CanonicalProduct } from "@/lib/client-portfolio/canonical-contract-read";
import { formatPortalPremiumLineCs } from "@/lib/client-portfolio/portal-portfolio-display";

export type AdvisorPrimaryAmount = {
  label: string;
  value: string;
};

/**
 * Hlavní částka / platba na kartě přehledu produktů — výhradně z kanonického modelu a surových polí smlouvy.
 * Žádné dopočítané nuly; „Dle smlouvy“ jen když v evidenci chybí částka.
 */
export function advisorPrimaryAmountPresentation(
  product: CanonicalProduct,
  contract: ContractRow,
): AdvisorPrimaryAmount {
  const d = product.segmentDetail;
  if (d?.kind === "loan") {
    if (d.loanPrincipal?.trim()) return { label: "Jistina", value: d.loanPrincipal.trim() };
    if (d.monthlyPayment != null && d.monthlyPayment > 0) {
      return {
        label: "Měsíční splátka",
        value: `${d.monthlyPayment.toLocaleString("cs-CZ")} Kč`,
      };
    }
  }
  if (d?.kind === "pension" && d.participantContribution?.trim()) {
    return { label: "Příspěvek účastníka", value: d.participantContribution.trim() };
  }
  const investmentPaymentType =
    d?.kind === "investment" ? d.paymentType : null;
  const line = formatPortalPremiumLineCs(
    contract.premiumAmount,
    contract.premiumAnnual,
    investmentPaymentType,
  );
  if (d?.kind === "investment") {
    return {
      label: d.paymentType === "one_time" ? "Jednorázová investice" : "Platba",
      value: line,
    };
  }
  if (d?.kind === "life_insurance") return { label: "Pojistné", value: line };
  if (d?.kind === "vehicle" || d?.kind === "property") return { label: "Pojistné", value: line };
  return { label: "Částka", value: line };
}
