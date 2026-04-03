import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { requireClientZoneAuth } from "@/lib/auth/require-auth";
import { getPortalNotificationsUnreadCount } from "@/app/actions/portal-notifications";
import { getAssignedAdvisorForClient } from "@/app/actions/client-dashboard";
import { getUnreadAdvisorMessagesForClientCount } from "@/app/actions/messages";
import { isMobileUiV1EnabledForRequest } from "@/app/shared/mobile-ui/feature-flag";
import { db, contacts, and, eq } from "db";
import { ClientPortalShell } from "./ClientPortalShell";
import { ClientMobileApp } from "./mobile/ClientMobileApp";
import { isClientMobileSpaPath } from "@/lib/client-portal/client-mobile-spa-paths";
import "./client-portal.css";

function isRedirectError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { digest?: string }).digest === "NEXT_REDIRECT";
}

export default async function ClientZoneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let auth;
  try {
    auth = await requireClientZoneAuth();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    redirect("/prihlaseni?error=auth_error");
  }

  const headerList = await headers();
  const cookieStore = await cookies();
  const mobileUiEnabled = isMobileUiV1EnabledForRequest({
    userAgent: headerList.get("user-agent"),
    cookieStore,
  });
  const pathname = headerList.get("x-pathname") ?? "";
  const useMobileSpa = pathname === "" || isClientMobileSpaPath(pathname);

  if (mobileUiEnabled && auth.contactId && useMobileSpa) {
    return <ClientMobileApp />;
  }

  let unreadNotificationsCount = 0;
  let unreadMessagesCount = 0;
  let contact: { firstName: string | null; lastName: string | null } | null = null;
  let advisor: Awaited<ReturnType<typeof getAssignedAdvisorForClient>> = null;
  try {
    [unreadNotificationsCount, unreadMessagesCount, contact, advisor] = await Promise.all([
      getPortalNotificationsUnreadCount(),
      // 5F: include unread messages in bell total
      auth.contactId ? getUnreadAdvisorMessagesForClientCount().catch(() => 0) : Promise.resolve(0),
      auth.contactId
        ? db
            .select({
              firstName: contacts.firstName,
              lastName: contacts.lastName,
            })
            .from(contacts)
            .where(and(eq(contacts.tenantId, auth.tenantId), eq(contacts.id, auth.contactId)))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      auth.contactId ? getAssignedAdvisorForClient(auth.contactId).catch(() => null) : Promise.resolve(null),
    ]);
  } catch {
    unreadNotificationsCount = 0;
    unreadMessagesCount = 0;
    contact = null;
    advisor = null;
  }

  const fullName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : "Klient";

  return (
    <ClientPortalShell
      unreadNotificationsCount={unreadNotificationsCount + unreadMessagesCount}
      fullName={fullName}
      advisor={advisor}
    >
      {children}
    </ClientPortalShell>
  );
}
