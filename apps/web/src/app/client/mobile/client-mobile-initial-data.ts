import type { ClientAdvisorInfo } from "@/app/actions/client-dashboard";
import type { ContractRow } from "@/app/actions/contracts";
import type { DocumentRow } from "@/app/actions/documents";
import type { PortalNotificationRow } from "@/app/actions/portal-notifications";
import type { ClientHouseholdDetail } from "@/app/actions/households";
import type { ClientRequestItem } from "@/app/lib/client-portal/request-types";

export type ClientMobileInitialData = {
  contactId: string;
  fullName: string;
  advisor: ClientAdvisorInfo | null;
  profile: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
  } | null;
  quickStats: {
    assetsUnderManagement: number;
    monthlyInvestments: number;
    riskCoveragePercent: number;
  };
  requests: ClientRequestItem[];
  contracts: ContractRow[];
  documents: DocumentRow[];
  notifications: PortalNotificationRow[];
  household: ClientHouseholdDetail | null;
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
};
