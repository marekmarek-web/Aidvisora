import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function NewClientRequestPage() {
  const auth = await requireAuth();
  if (auth.roleName !== "Client" || !auth.contactId) redirect("/client");
  redirect("/client/requests");
}
