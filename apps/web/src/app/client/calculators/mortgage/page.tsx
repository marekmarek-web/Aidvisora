import { MortgageCalculatorPage } from "@/app/portal/calculators/_components/mortgage/MortgageCalculatorPage";
import { requireClientZoneAuth } from "@/lib/auth/require-auth";

export default async function ClientMortgageCalculatorPage() {
  const auth = await requireClientZoneAuth();
  if (!auth.contactId) return null;

  return <MortgageCalculatorPage audience="client" />;
}
