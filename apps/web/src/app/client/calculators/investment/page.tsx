import { InvestmentCalculatorPage } from "@/app/portal/calculators/_components/investment/InvestmentCalculatorPage";
import { requireClientZoneAuth } from "@/lib/auth/require-auth";

export default async function ClientInvestmentCalculatorPage() {
  const auth = await requireClientZoneAuth();
  if (!auth.contactId) return null;

  return <InvestmentCalculatorPage audience="client" />;
}
