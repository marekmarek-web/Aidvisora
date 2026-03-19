import { ClientPaymentsView } from "./payments-client";
import { requireAuth } from "@/lib/auth/require-auth";
import { getPaymentInstructionsForContact } from "@/app/actions/payment-pdf";

export default async function ClientPaymentsPage() {
  const auth = await requireAuth();
  if (auth.roleName !== "Client" || !auth.contactId) return null;

  const paymentInstructions = await getPaymentInstructionsForContact(
    auth.contactId
  );

  return <ClientPaymentsView paymentInstructions={paymentInstructions} />;
}
