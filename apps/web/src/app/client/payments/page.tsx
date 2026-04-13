import { ClientPaymentsView } from "./payments-client";
import { requireClientZoneAuth } from "@/lib/auth/require-auth";
import { getPaymentInstructionsForContact } from "@/app/actions/payment-pdf";

export default async function ClientPaymentsPage() {
  const auth = await requireClientZoneAuth();
  if (!auth.contactId) return null;

  let paymentInstructions = [];
  try {
    paymentInstructions = await getPaymentInstructionsForContact(auth.contactId);
  } catch {
    // Payments page must never crash — show empty state on any fetch error
    paymentInstructions = [];
  }

  return <ClientPaymentsView paymentInstructions={paymentInstructions} />;
}
