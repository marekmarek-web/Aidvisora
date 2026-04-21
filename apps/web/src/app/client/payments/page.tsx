import { ClientPaymentsView } from "./payments-client";
import { requireClientZoneAuth } from "@/lib/auth/require-auth";
import {
  getPaymentInstructionsForContact,
  type PaymentInstruction,
} from "@/app/actions/payment-pdf";

export default async function ClientPaymentsPage() {
  const auth = await requireClientZoneAuth();
  if (!auth.contactId) return null;

  let paymentInstructions: PaymentInstruction[] = [];
  let paymentsLoadFailed = false;
  try {
    paymentInstructions = await getPaymentInstructionsForContact(auth.contactId);
  } catch (err) {
    // Log do Vercel / Sentry — dříve se chyba tiše spolkla a klient jen viděl
    // "Platební údaje se nepodařilo načíst", což bránilo diagnostice (např.
    // schema drift po zapomenuté migraci contacts → SELECT * v action spadlo).
    console.error("[client/payments] getPaymentInstructionsForContact failed", {
      contactId: auth.contactId,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });
    paymentsLoadFailed = true;
    paymentInstructions = [];
  }

  return (
    <ClientPaymentsView paymentInstructions={paymentInstructions} paymentsLoadFailed={paymentsLoadFailed} />
  );
}
