import { ClientSidebar } from "./ClientSidebar";
import { ClientPortalTopbar } from "./ClientPortalTopbar";
import { ClientMaterialRequestToastStack } from "./ClientMaterialRequestToastStack";

export type PortalFeatures = {
  messagingEnabled: boolean;
  serviceRequestsEnabled: boolean;
};

type ClientPortalShellProps = {
  children: React.ReactNode;
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
  activeProposalsCount?: number;
  fullName: string;
  advisor: { fullName: string; email?: string | null; initials: string } | null;
  portalFeatures?: PortalFeatures;
};

export function ClientPortalShell({
  children,
  unreadNotificationsCount,
  unreadMessagesCount,
  activeProposalsCount = 0,
  fullName,
  advisor,
  portalFeatures,
}: ClientPortalShellProps) {
  return (
    <div className="client-portal-root flex min-h-screen bg-slate-50 text-slate-800">
      <ClientSidebar
        unreadNotificationsCount={unreadNotificationsCount}
        unreadMessagesCount={unreadMessagesCount}
        activeProposalsCount={activeProposalsCount}
        advisor={advisor}
        portalFeatures={portalFeatures}
      />
      <div className="flex flex-col flex-1 min-w-0 ml-12 md:ml-[280px]">
        <ClientPortalTopbar
          unreadNotificationsCount={unreadNotificationsCount}
          fullName={fullName}
        />
        <main className="flex-1 client-dot-grid client-custom-scrollbar overflow-y-auto">
          <div className="relative z-10 p-4 sm:p-5 lg:p-6 max-w-[1400px] mx-auto w-full">{children}</div>
          <ClientMaterialRequestToastStack />
        </main>
      </div>
    </div>
  );
}
