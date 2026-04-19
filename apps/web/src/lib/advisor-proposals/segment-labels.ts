import type { AdvisorProposalSegment, AdvisorProposalStatus } from "db";

export const ADVISOR_PROPOSAL_SEGMENT_LABELS: Record<AdvisorProposalSegment, string> = {
  insurance_auto: "Pojištění vozidel",
  insurance_property: "Pojištění majetku",
  insurance_life: "Životní pojištění",
  mortgage: "Hypotéka",
  credit: "Úvěr / refinancování",
  investment: "Investice",
  pension: "Penze / DPS",
  other: "Jiné",
};

export const ADVISOR_PROPOSAL_SEGMENT_OPTIONS: {
  value: AdvisorProposalSegment;
  label: string;
}[] = [
  { value: "insurance_auto", label: ADVISOR_PROPOSAL_SEGMENT_LABELS.insurance_auto },
  { value: "insurance_property", label: ADVISOR_PROPOSAL_SEGMENT_LABELS.insurance_property },
  { value: "insurance_life", label: ADVISOR_PROPOSAL_SEGMENT_LABELS.insurance_life },
  { value: "mortgage", label: ADVISOR_PROPOSAL_SEGMENT_LABELS.mortgage },
  { value: "credit", label: ADVISOR_PROPOSAL_SEGMENT_LABELS.credit },
  { value: "investment", label: ADVISOR_PROPOSAL_SEGMENT_LABELS.investment },
  { value: "pension", label: ADVISOR_PROPOSAL_SEGMENT_LABELS.pension },
  { value: "other", label: ADVISOR_PROPOSAL_SEGMENT_LABELS.other },
];

export const ADVISOR_PROPOSAL_STATUS_LABELS: Record<AdvisorProposalStatus, string> = {
  draft: "Koncept",
  published: "Publikováno klientovi",
  viewed: "Klient zobrazil",
  accepted: "Klient chce probrat",
  declined: "Klient odmítl",
  expired: "Vypršelo",
  withdrawn: "Staženo",
};

export function formatMoneyCs(n: number | null | undefined, currency: string = "CZK"): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("cs-CZ")} ${currency}`;
}

/** DD.MM.YYYY z ISO date stringu "YYYY-MM-DD". */
export function formatDateCs(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
