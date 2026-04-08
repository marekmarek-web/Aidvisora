import type { TerminationMode, TerminationReasonCode } from "@/lib/db/schema-for-client";

/** Mapování režimu průvodce → kód důvodu pro rules engine / API (1:1, beze změny logiky). */
const MODE_TO_REASON: Record<TerminationMode, TerminationReasonCode> = {
  end_of_insurance_period: "end_of_period_6_weeks",
  fixed_calendar_date: "fixed_date_if_contractually_allowed",
  within_two_months_from_inception: "within_2_months_from_inception",
  after_claim: "after_claim_event",
  distance_withdrawal: "distance_contract_withdrawal",
  mutual_agreement: "mutual_agreement",
  manual_review_other: "special_reason_manual_review",
};

export function modeToReasonCode(mode: TerminationMode): TerminationReasonCode {
  return MODE_TO_REASON[mode] ?? "special_reason_manual_review";
}
