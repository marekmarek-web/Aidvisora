import { ClientPaymentsView } from "./payments-client";
import { requireClientZoneAuth } from "@/lib/auth/require-auth";
import { getPaymentInstructionsForContact } from "@/app/actions/payment-pdf";

export default async function ClientPaymentsPage() {
  const auth = await requireClientZoneAuth();
  if (!auth.contactId) return null;

  const paymentInstructions = await getPaymentInstructionsForContact(
    auth.contactId
  );

  return <ClientPaymentsView paymentInstructions={paymentInstructions} />;
}
