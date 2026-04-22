import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { requireClientZoneAuth, getCachedSupabaseUser } from "@/lib/auth/require-auth";
import { getPortalNotificationsUnreadCount } from "@/app/actions/portal-notifications";
import { getAssignedAdvisorForClient } from "@/app/actions/client-dashboard";
import { getUnreadAdvisorMessagesForClientCount } from "@/app/actions/messages";
import { getActiveAdvisorProposalCountForClient } from "@/app/actions/advisor-proposals-client";
import { isMobileUiV1EnabledForRequest } from "@/app/shared/mobile-ui/feature-flag";
import { getEffectiveTenantSettingsForWorkspaceResolved } from "@/lib/billing/effective-workspace";
import { contacts, and, eq } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import { ClientPortalShell } from "./ClientPortalShell";
import { ClientMobileApp } from "./mobile/ClientMobileApp";
import { MaintenanceBanner } from "@/app/components/MaintenanceBanner";
import { isClientMobileSpaPath } from "@/lib/client-portal/client-mobile-spa-paths";
import "@/styles/aidvisora-components.css";
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

  const supabaseUser = await getCachedSupabaseUser().catch(() => null);
  const portalSettingsResult = await getEffectiveTenantSettingsForWorkspaceResolved({
    tenantId: auth.tenantId,
    userId: auth.userId,
    email: supabaseUser?.email ?? null,
  }).catch(() => null);
  const portalFeatures = {
    messagingEnabled: portalSettingsResult?.settings?.["client_portal.allow_messaging"] ?? true,
    serviceRequestsEnabled: portalSettingsResult?.settings?.["client_portal.allow_service_requests"] ?? true,
  };

  // B1.4: Každý fetch má vlastní catch → Sentry capture + nezhroutí se celý shell.
  // Drží false pro „selhalo“, aby UI mohlo zobrazit warning místo falešné nuly.
  let shellLoadFailed = false;
  const logShellError = (scope: string, err: unknown) => {
    shellLoadFailed = true;
    try {
      // Dynamic import se používá místo top-level importu, aby layout nespadl při změně API Sentry.
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(err, { tags: { area: "client-portal-shell", scope } });
      }).catch(() => {});
    } catch {
      // no-op
    }
    // eslint-disable-next-line no-console
    console.error(`[client/layout] ${scope} failed`, err);
  };
  const [unreadNotificationsCount, unreadMessagesCount, activeProposalsCount, contact, advisor] = await Promise.all([
    getPortalNotificationsUnreadCount().catch((e) => {
      logShellError("getPortalNotificationsUnreadCount", e);
      return 0;
    }),
    auth.contactId
      ? getUnreadAdvisorMessagesForClientCount().catch((e) => {
          logShellError("getUnreadAdvisorMessagesForClientCount", e);
          return 0;
        })
      : Promise.resolve(0),
    auth.contactId
      ? getActiveAdvisorProposalCountForClient().catch((e) => {
          logShellError("getActiveAdvisorProposalCountForClient", e);
          return 0;
        })
      : Promise.resolve(0),
    auth.contactId
      ? withTenantContext({ tenantId: auth.tenantId, userId: auth.userId }, (tx) =>
          tx
            .select({
              firstName: contacts.firstName,
              lastName: contacts.lastName,
            })
            .from(contacts)
            .where(and(eq(contacts.tenantId, auth.tenantId), eq(contacts.id, auth.contactId!)))
            .limit(1)
            .then((rows) => rows[0] ?? null),
        ).catch((e) => {
          logShellError("loadContact", e);
          return null as { firstName: string | null; lastName: string | null } | null;
        })
      : Promise.resolve(null as { firstName: string | null; lastName: string | null } | null),
    auth.contactId
      ? getAssignedAdvisorForClient(auth.contactId).catch((e) => {
          logShellError("getAssignedAdvisorForClient", e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const fullName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : "Klient";

  return (
    <>
      {/* Delta A23 — client portal maintenance banner (Edge Config kill-switch). */}
      <MaintenanceBanner />
      <ClientPortalShell
        unreadNotificationsCount={unreadNotificationsCount + unreadMessagesCount}
        unreadMessagesCount={unreadMessagesCount}
        activeProposalsCount={activeProposalsCount}
        fullName={fullName}
        advisor={advisor}
        portalFeatures={portalFeatures}
        shellLoadFailed={shellLoadFailed}
      >
        {children}
      </ClientPortalShell>
    </>
  );
}
