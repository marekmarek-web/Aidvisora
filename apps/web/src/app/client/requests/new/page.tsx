import { requireClientZoneAuth } from "@/lib/auth/require-auth";
import { NewClientRequestStandalone } from "./NewClientRequestStandalone";

export default async function NewClientRequestPage({
  searchParams,
}: {
  searchParams?: Promise<{ caseType?: string }>;
}) {
  await requireClientZoneAuth();
  const sp = (await searchParams) ?? {};
  return <NewClientRequestStandalone defaultCaseType={sp.caseType} />;
}
