import { ClientCalculators } from "./ClientCalculators";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function ClientCalculatorsPage() {
  const auth = await requireAuth();
  if (auth.roleName !== "Client" || !auth.contactId) return null;

  return <ClientCalculators />;
}
