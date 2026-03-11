import { requireAuth } from "@/lib/auth/require-auth";
import { redirect } from "next/navigation";
import { PortalMessagesView } from "./PortalMessagesView";

export default async function PortalMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  const auth = await requireAuth();
  const { contact: contactParam } = await searchParams;

  if (auth.roleName === "Client") {
    redirect("/client/messages");
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PortalMessagesView initialContactId={contactParam ?? null} />
    </div>
  );
}
