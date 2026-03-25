import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import { AiAssistantChatScreen } from "../mobile/screens/AiAssistantChatScreen";

function isRedirectError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { digest?: string }).digest === "NEXT_REDIRECT";
}

export default async function PortalAiPage() {
  let auth;
  try {
    auth = await requireAuth();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    redirect("/prihlaseni?next=/portal/ai");
  }
  if (auth.roleName === "Client") redirect("/client");

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-3xl mx-auto p-4">
      <AiAssistantChatScreen />
    </div>
  );
}
