import { and, contacts, db, eq } from "db";
import { getClientDashboardMetrics, type ClientAdvisorInfo } from "@/app/actions/client-dashboard";
import { getClientRequests } from "@/app/actions/client-portal-requests";
import { getClientPortfolioForContact } from "@/app/actions/contracts";
import { getDocumentsForClient } from "@/app/actions/documents";
import { getPortalNotificationsForClient, getPortalNotificationsUnreadCount } from "@/app/actions/portal-notifications";
import { getClientHouseholdForContact } from "@/app/actions/households";
import { getUnreadAdvisorMessagesForClientCount } from "@/app/actions/messages";
import { Suspense } from "react";
import type { ClientMobileInitialData } from "./client-mobile-initial-data";
import { ClientMobileClient } from "./ClientMobileClient";

export async function ClientMobileApp({
  contactId,
  fullName,
  unreadNotificationsCount,
  advisor,
}: {
  contactId: string;
  fullName: string;
  unreadNotificationsCount: number;
  advisor: ClientAdvisorInfo | null;
}) {
  const [profile, quickStats, requests, contracts, documents, notifications, household, unreadMessagesCount] =
    await Promise.all([
      db
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          phone: contacts.phone,
          street: contacts.street,
          city: contacts.city,
          zip: contacts.zip,
        })
        .from(contacts)
        .where(and(eq(contacts.id, contactId)))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      getClientDashboardMetrics(contactId).catch(() => ({
        assetsUnderManagement: 0,
        monthlyInvestments: 0,
        monthlyInsurancePremiums: 0,
        activeContractCount: 0,
      })),
      getClientRequests().catch(() => []),
      getClientPortfolioForContact(contactId).catch(() => []),
      getDocumentsForClient(contactId).catch(() => []),
      getPortalNotificationsForClient().catch(() => []),
      getClientHouseholdForContact(contactId).catch(() => null),
      getUnreadAdvisorMessagesForClientCount().catch(() => 0),
    ]);

  const unreadNotifications = await getPortalNotificationsUnreadCount().catch(() => unreadNotificationsCount);

  const initialData: ClientMobileInitialData = {
    contactId,
    fullName,
    advisor,
    profile,
    quickStats,
    requests,
    contracts,
    documents,
    notifications,
    household,
    unreadNotificationsCount: unreadNotifications,
    unreadMessagesCount,
  };

  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-slate-500 text-sm p-6">
          Načítám…
        </div>
      }
    >
      <ClientMobileClient initialData={initialData} />
    </Suspense>
  );
}
