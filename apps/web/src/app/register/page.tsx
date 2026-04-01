import { redirect } from "next/navigation";
import {
  CLIENT_INVITE_QUERY_PARAM,
  parseClientInviteTokenFromUrl,
} from "@/lib/auth/client-invite-url";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /register nikdy neobsluhujeme – s platným invite tokenem jdeme na přihlášení (bez režimu registrace poradce), jinak na úvod. */
export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  const rawLegacy = params?.token;
  const rawNew = params?.[CLIENT_INVITE_QUERY_PARAM];
  if (typeof rawLegacy === "string") sp.set("token", rawLegacy);
  if (typeof rawNew === "string") sp.set(CLIENT_INVITE_QUERY_PARAM, rawNew);
  const inviteToken = parseClientInviteTokenFromUrl(sp);
  if (inviteToken) {
    redirect(`/prihlaseni?${CLIENT_INVITE_QUERY_PARAM}=${encodeURIComponent(inviteToken)}`);
  }
  const q = new URLSearchParams();
  q.set("register", "1");
  redirect("/?" + q.toString());
}
