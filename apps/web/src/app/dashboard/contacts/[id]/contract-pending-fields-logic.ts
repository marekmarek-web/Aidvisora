/**
 * Fáze 16: Čistá logika pro ContractPendingFieldsGuard — bez závislostí na server-only.
 * Importovatelná jak z Client Componentů, tak z testů.
 */

export type ContractFieldScope = "contract" | "payment";

/**
 * Stav pending pole pro contract completeness guard.
 * - "pending_ai"   : pole čeká na potvrzení poradcem (prefill_confirm policy)
 * - "manual"       : pole vyžaduje ruční doplnění (manual_required policy)
 */
export type ContractFieldStatus = "pending_ai" | "manual";

export type ContractPendingFieldResult = {
  key: string;
  label: string;
  status: ContractFieldStatus;
  scope: ContractFieldScope;
};

export type ContractProvenanceInput = {
  reviewId: string;
  pendingContractFields: string[];
  manualRequiredContractFields: string[];
  pendingPaymentFields: string[];
  manualRequiredPaymentFields: string[];
  supportingDocumentGuard: boolean;
} | null;

/** Lidské labely pro contract-level pending pole. */
const CONTRACT_FIELD_LABELS: Record<string, string> = {
  contractNumber: "Číslo smlouvy",
  proposalNumber: "Číslo návrhu",
  policyStartDate: "Začátek pojištění",
  policyEndDate: "Konec pojištění",
  policyDuration: "Délka pojištění",
  premiumAmount: "Výše pojistného",
  premiumAnnual: "Roční pojistné",
  partnerName: "Pojišťovna / Poskytovatel",
  productName: "Produkt",
  segment: "Segment",
  startDate: "Datum začátku",
  anniversaryDate: "Datum výročí",
  totalMonthlyPremium: "Celkové měsíční pojistné",
  installmentAmount: "Výše splátky",
  loanAmount: "Výše úvěru",
  interestRate: "Úroková sazba",
  loanTerm: "Délka úvěru",
  customerNumber: "Číslo zákazníka",
  fundName: "Název fondu",
  amountToPay: "Částka k úhradě",
};

const PAYMENT_FIELD_LABELS: Record<string, string> = {
  bankAccount: "Číslo účtu",
  variableSymbol: "Variabilní symbol",
  bankCode: "Kód banky",
  iban: "IBAN",
  specificSymbol: "Specifický symbol",
  paymentFrequency: "Frekvence platby",
  regularAmount: "Pravidelná částka",
  oneOffAmount: "Jednorázová částka",
  firstDueDate: "Datum první splatnosti",
  recipientAccount: "Číslo účtu příjemce",
  obligationName: "Název závazku",
};

function fieldLabel(key: string, scope: ContractFieldScope): string {
  const map = scope === "contract" ? CONTRACT_FIELD_LABELS : PAYMENT_FIELD_LABELS;
  return map[key] ?? key;
}

/**
 * Fáze 16: Vrátí seznam pending nebo manual polí pro contract/payment scope.
 *
 * Supporting document guard: pokud provenance.supportingDocumentGuard = true,
 * vrátí prázdné pole — supporting docs nesmí generovat inline confirm CTA.
 */
export function resolveContractPendingFields(
  provenance: ContractProvenanceInput,
): ContractPendingFieldResult[] {
  if (!provenance) return [];
  // Supporting document guard — tvrdý
  if (provenance.supportingDocumentGuard) return [];

  const results: ContractPendingFieldResult[] = [];

  for (const key of provenance.pendingContractFields) {
    results.push({
      key,
      label: fieldLabel(key, "contract"),
      status: "pending_ai",
      scope: "contract",
    });
  }

  for (const key of provenance.pendingPaymentFields) {
    results.push({
      key,
      label: fieldLabel(key, "payment"),
      status: "pending_ai",
      scope: "payment",
    });
  }

  for (const key of provenance.manualRequiredContractFields) {
    // Nezobrazuj manual pole, která jsou již v pending (pro případ overlap)
    if (!provenance.pendingContractFields.includes(key)) {
      results.push({
        key,
        label: fieldLabel(key, "contract"),
        status: "manual",
        scope: "contract",
      });
    }
  }

  for (const key of provenance.manualRequiredPaymentFields) {
    if (!provenance.pendingPaymentFields.includes(key)) {
      results.push({
        key,
        label: fieldLabel(key, "payment"),
        status: "manual",
        scope: "payment",
      });
    }
  }

  return results;
}

export function hasPendingContractFields(provenance: ContractProvenanceInput): boolean {
  if (!provenance) return false;
  if (provenance.supportingDocumentGuard) return false;
  return (
    provenance.pendingContractFields.length > 0 ||
    provenance.pendingPaymentFields.length > 0 ||
    provenance.manualRequiredContractFields.length > 0 ||
    provenance.manualRequiredPaymentFields.length > 0
  );
}
