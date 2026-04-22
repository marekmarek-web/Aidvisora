import { z } from "zod";
import type { WizardReviewRow } from "@/app/components/wizard";
import { segmentLabel } from "@/app/lib/segment-labels";
import { formatDisplayDateCs } from "@/lib/date/format-display-cs";
import {
  type ContractSegmentCode,
  CONTRACT_SEGMENT_CODES,
  getSegmentUiGroup,
  segmentShowsPremiumOrContributionFields,
  segmentUsesAnnualPremiumPrimaryInput,
} from "@/lib/contracts/contract-segment-wizard-config";
import {
  annualPremiumFromMonthlyInput,
  annualPremiumPillLabel,
  monthlyPremiumFromAnnualInput,
  monthlyPremiumPillLabel,
} from "@/lib/contracts/annual-premium-from-monthly";

const segmentSchema = z.enum(
  [...CONTRACT_SEGMENT_CODES] as [ContractSegmentCode, ...ContractSegmentCode[]]
);

/**
 * Frekvence platby — zdroj pravdy pro derivaci `paymentType`, `premiumAmount` a `premiumAnnual`.
 * - `monthly`     → advisor zadává měsíční částku; roční = x × 12.
 * - `annual`      → advisor zadává roční částku; měsíční = x ÷ 12.
 * - `quarterly`   → advisor zadává čtvrtletní částku; roční = x × 4, měsíční = x ÷ 3.
 * - `semiannual`  → advisor zadává pololetní částku; roční = x × 2, měsíční = x ÷ 6.
 * - `one_time`    → advisor zadává jednorázovou částku; `premiumAnnual` = null, `paymentType` = "one_time".
 */
export type ContractPaymentFrequency =
  | "monthly"
  | "annual"
  | "quarterly"
  | "semiannual"
  | "one_time";

export type ContractFormState = {
  segment: string;
  partnerId: string;
  productId: string;
  partnerName: string;
  productName: string;
  premiumAmount: string;
  premiumAnnual: string;
  contractNumber: string;
  startDate: string;
  anniversaryDate: string;
  note: string;
  /** "one_time" = jednorázová platba (investiční pokyn); "regular" = pravidelná; null = neznámo */
  paymentType: "one_time" | "regular" | null;
  /**
   * Frekvence platby — explicitní vstup z wizardu, určuje derivaci paymentType
   * a obou částek. Monthly = default, pokud advisor neurčí jinak.
   */
  paymentFrequency: ContractPaymentFrequency;
};

/** Payload pro createContract / updateContract (normalizovaný). */
export type ContractPersistPayload = {
  segment: string;
  partnerId?: string;
  productId?: string;
  partnerName?: string;
  productName?: string;
  premiumAmount?: string;
  premiumAnnual?: string;
  contractNumber?: string;
  startDate?: string;
  anniversaryDate?: string;
  note?: string;
  /** "one_time" = jednorázová platba; "regular" = pravidelná; undefined = neuvádí se / neznámo */
  paymentType?: "one_time" | "regular";
  /** Explicitní frekvence z wizardu — propaguje se do portfolio_attributes.paymentFrequencyLabel. */
  paymentFrequency?: ContractPaymentFrequency;
  /** Čitelný label pro portfolio_attributes (cs) — derivuje se z paymentFrequency. */
  paymentFrequencyLabel?: string;
};

const PAYMENT_FREQUENCY_LABELS_CS: Record<ContractPaymentFrequency, string> = {
  monthly: "měsíčně",
  annual: "ročně",
  quarterly: "čtvrtletně",
  semiannual: "pololetně",
  one_time: "jednorázově",
};

export function paymentFrequencyLabelCs(freq: ContractPaymentFrequency): string {
  return PAYMENT_FREQUENCY_LABELS_CS[freq];
}

export function isContractPaymentFrequency(v: unknown): v is ContractPaymentFrequency {
  return (
    v === "monthly" ||
    v === "annual" ||
    v === "quarterly" ||
    v === "semiannual" ||
    v === "one_time"
  );
}

/** Derivace `paymentType` z frekvence (jednorázově → one_time, jinak regular). */
export function paymentTypeFromFrequency(freq: ContractPaymentFrequency): "one_time" | "regular" {
  return freq === "one_time" ? "one_time" : "regular";
}

const optionalTrimmed = z
  .string()
  .optional()
  .transform((s) => (s != null && s.trim() !== "" ? s : undefined));

export function normalizeContractFormForSave(form: ContractFormState): ContractPersistPayload {
  const segment = form.segment?.trim();
  if (!segment) return { segment: "" };

  const showPremium = segmentShowsPremiumOrContributionFields(segment);
  // Zdroj pravdy: explicitní `paymentFrequency` ze segmented control.
  // `paymentType` derivujeme z frekvence; zachováváme zpětnou kompatibilitu pro
  // volání, která dodávají jen `paymentType` (vytvořená před F2 rolloutem).
  const frequency: ContractPaymentFrequency = isContractPaymentFrequency(form.paymentFrequency)
    ? form.paymentFrequency
    : form.paymentType === "one_time"
      ? "one_time"
      : "monthly";
  const paymentType = paymentTypeFromFrequency(frequency);
  const isOneTime = frequency === "one_time";

  let premiumAmount = form.premiumAmount?.trim() || undefined;
  let premiumAnnual = form.premiumAnnual?.trim() || undefined;
  if (showPremium) {
    if (isOneTime) {
      // Jednorázová platba: částka v `premiumAmount` je lump-sum, roční NESMÍ existovat.
      // Dříve portál ukazoval „12 000 000 Kč / rok“ místo „1 000 000 Kč jednorázově“.
      premiumAnnual = undefined;
    } else if (frequency === "annual") {
      // Advisor zadal roční částku — dopočítáme měsíční.
      if (premiumAnnual) {
        premiumAmount = monthlyPremiumFromAnnualInput(premiumAnnual) || premiumAmount;
      } else if (premiumAmount) {
        premiumAnnual = annualPremiumFromMonthlyInput(premiumAmount) || premiumAnnual;
      }
    } else if (frequency === "quarterly") {
      // Čtvrtletní částka × 4 = roční, měsíční = roční / 12.
      if (premiumAmount) {
        const annualNumber = Number(premiumAmount) * 4;
        if (Number.isFinite(annualNumber) && annualNumber > 0) {
          premiumAnnual = annualNumber.toFixed(2);
          premiumAmount = monthlyPremiumFromAnnualInput(premiumAnnual) || premiumAmount;
        }
      }
    } else if (frequency === "semiannual") {
      if (premiumAmount) {
        const annualNumber = Number(premiumAmount) * 2;
        if (Number.isFinite(annualNumber) && annualNumber > 0) {
          premiumAnnual = annualNumber.toFixed(2);
          premiumAmount = monthlyPremiumFromAnnualInput(premiumAnnual) || premiumAmount;
        }
      }
    } else if (segmentUsesAnnualPremiumPrimaryInput(segment)) {
      // MAJ: historicky primární vstup je roční → měsíční dopočítáme.
      if (premiumAnnual) {
        const m = monthlyPremiumFromAnnualInput(premiumAnnual);
        if (m) premiumAmount = m;
      } else if (premiumAmount) {
        premiumAnnual = annualPremiumFromMonthlyInput(premiumAmount) || premiumAnnual;
      }
    } else if (premiumAmount) {
      // monthly (default): měsíční × 12 = roční.
      premiumAnnual = annualPremiumFromMonthlyInput(premiumAmount) || premiumAnnual;
    }
  }
  if (!showPremium) {
    premiumAmount = undefined;
    premiumAnnual = undefined;
  }

  const partnerId = form.partnerId?.trim() || undefined;
  let productId = form.productId?.trim() || undefined;
  // Produkt v DB vždy patří partnerovi — osiřelé productId po změně partnera způsobovalo falešné chyby
  if (!partnerId && productId) productId = undefined;

  return {
    segment,
    partnerId,
    productId,
    partnerName: form.partnerName?.trim() || undefined,
    productName: form.productName?.trim() || undefined,
    premiumAmount,
    premiumAnnual,
    contractNumber: form.contractNumber?.trim() || undefined,
    startDate: form.startDate?.trim() || undefined,
    anniversaryDate: form.anniversaryDate?.trim() || undefined,
    note: form.note?.trim() || undefined,
    paymentType,
    paymentFrequency: frequency,
    paymentFrequencyLabel: paymentFrequencyLabelCs(frequency),
  };
}

const persistSchema = z.object({
  segment: segmentSchema,
  partnerId: optionalTrimmed,
  productId: optionalTrimmed,
  partnerName: optionalTrimmed,
  productName: optionalTrimmed,
  premiumAmount: optionalTrimmed,
  premiumAnnual: optionalTrimmed,
  contractNumber: optionalTrimmed,
  startDate: optionalTrimmed,
  anniversaryDate: optionalTrimmed,
  note: optionalTrimmed,
  paymentType: z.enum(["one_time", "regular"]).optional(),
  paymentFrequency: z.enum(["monthly", "annual", "quarterly", "semiannual", "one_time"]).optional(),
  paymentFrequencyLabel: optionalTrimmed,
});

/** Validace před uložením (klient i server). */
export function validateContractPersistPayload(
  payload: ContractPersistPayload
): { ok: true; data: z.infer<typeof persistSchema> } | { ok: false; message: string } {
  const parsed = persistSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      message: first?.message ?? "Neplatné údaje smlouvy.",
    };
  }
  return { ok: true, data: parsed.data };
}

/** Chybová hláška v češtině pro prázdný segment. */
export function validateContractFormForSubmit(form: ContractFormState): { ok: true } | { ok: false; message: string } {
  const segment = form.segment?.trim();
  if (!segment) {
    return { ok: false, message: "Vyberte segment smlouvy." };
  }
  if (!segmentSchema.safeParse(segment).success) {
    return { ok: false, message: "Neplatný segment smlouvy. Vyberte segment z nabídky." };
  }
  const normalized = normalizeContractFormForSave(form);
  const v = validateContractPersistPayload(normalized);
  if (!v.ok) return v;

  const hasPartnerOrProduct =
    Boolean(normalized.partnerId?.trim()) ||
    Boolean(normalized.productId?.trim()) ||
    Boolean(normalized.partnerName?.trim()) ||
    Boolean(normalized.productName?.trim());
  if (!hasPartnerOrProduct) {
    return {
      ok: false,
      message: "Vyberte partnera a produkt z katalogu nebo vyplňte alespoň název partnera či produktu.",
    };
  }

  return { ok: true };
}

export function buildContractReviewRows(
  form: ContractFormState,
  uploadedDocumentName: string | null
): WizardReviewRow[] {
  const normalized = normalizeContractFormForSave(form);
  const segment = form.segment?.trim() ?? "";
  const rows: WizardReviewRow[] = [
    { label: "Segment", value: segmentLabel(segment) || "—" },
    {
      label: "Partner / Produkt",
      value: [form.partnerName, form.productName].filter(Boolean).join(" – ") || "—",
    },
  ];

  const group = getSegmentUiGroup(segment);
  if (group !== "lending") {
    const annualPrimary = segmentUsesAnnualPremiumPrimaryInput(segment);
    if (annualPrimary) {
      if (normalized.premiumAnnual) {
        rows.push({ label: "Pojistné (roční)", value: `${normalized.premiumAnnual} Kč` });
      }
      if (normalized.premiumAmount) {
        rows.push({ label: "Pojistné (měs.)", value: `${normalized.premiumAmount} Kč` });
      }
    } else {
      const oneTime = group === "investment" && normalized.paymentType === "one_time";
      if (normalized.premiumAmount) {
        const investmentLabel = oneTime ? "Jednorázová investice" : "Pravidelná platba (měs.)";
        rows.push({
          label: group === "investment" ? investmentLabel : "Pojistné (měs.)",
          value: `${normalized.premiumAmount} Kč`,
        });
      }
      if (!oneTime && normalized.premiumAnnual) {
        rows.push({
          label: group === "investment" ? "Příspěvek (roční)" : "Pojistné (roční)",
          value: `${normalized.premiumAnnual} Kč`,
        });
      }
    }
  }

  if (normalized.contractNumber) {
    rows.push({ label: "Číslo smlouvy", value: normalized.contractNumber });
  }
  if (normalized.startDate) {
    rows.push({
      label: "Od",
      value: formatDisplayDateCs(normalized.startDate) || normalized.startDate,
    });
  }
  if (normalized.anniversaryDate) {
    rows.push({
      label: getSegmentUiGroup(segment) === "lending" ? "Výročí / fixace" : "Výročí",
      value: formatDisplayDateCs(normalized.anniversaryDate) || normalized.anniversaryDate,
    });
  }
  if (normalized.note) {
    rows.push({ label: "Poznámka", value: normalized.note });
  }
  rows.push({
    label: "Soubor",
    value: uploadedDocumentName?.trim() || "—",
  });

  return rows;
}

/** Pill vedle vstupu pojistného — u MAJ odhad měsíční z ročního, jinde roční z měsíčního. */
export function contractFormAnnualPillLabel(form: ContractFormState): string | null {
  if (!segmentShowsPremiumOrContributionFields(form.segment)) return null;
  if (segmentUsesAnnualPremiumPrimaryInput(form.segment)) {
    return monthlyPremiumPillLabel(form.premiumAnnual);
  }
  return annualPremiumPillLabel(form.premiumAmount);
}

const EMPTY_STEP2: Pick<
  ContractFormState,
  | "premiumAmount"
  | "premiumAnnual"
  | "contractNumber"
  | "startDate"
  | "anniversaryDate"
  | "note"
  | "paymentType"
  | "paymentFrequency"
> = {
  premiumAmount: "",
  premiumAnnual: "",
  contractNumber: "",
  startDate: "",
  anniversaryDate: "",
  note: "",
  paymentType: "regular",
  paymentFrequency: "monthly",
};

/** Po změně segmentu: partner/produkt + pole kroku 2 vyčistit (volá se z wizardu). */
export function resetContractFormForNewSegment(
  prev: ContractFormState,
  newSegment: string
): ContractFormState {
  return {
    ...prev,
    segment: newSegment,
    partnerId: "",
    productId: "",
    partnerName: "",
    productName: "",
    ...EMPTY_STEP2,
  };
}

export const initialContractFormState = (): ContractFormState => ({
  segment: "ZP",
  partnerId: "",
  productId: "",
  partnerName: "",
  productName: "",
  premiumAmount: "",
  premiumAnnual: "",
  contractNumber: "",
  startDate: "",
  anniversaryDate: "",
  note: "",
  // Default: měsíčně/pravidelně. `null` bylo kořenem KPI bugu „Měsíční investice"
  // (jednorázovky se počítaly jako měsíční, protože paymentType = null → fallback "regular").
  paymentType: "regular",
  paymentFrequency: "monthly",
});
