import { redirect } from "next/navigation";
import { requireClientZoneAuth } from "@/lib/auth/require-auth";

export default async function NewClientRequestPage() {
  await requireClientZoneAuth();
  redirect("/client/requests");
}
