"use server";

import { submitReferral } from "@/lib/referrals/public";

/**
 * Public action pro odeslání referral formuláře — bez auth, jen token-based.
 */
export async function submitReferralAction(input: {
  token: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  consent: boolean;
}): Promise<{ ok: true }> {
  return submitReferral(input.token, {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    note: input.note,
    consent: input.consent,
  });
}
