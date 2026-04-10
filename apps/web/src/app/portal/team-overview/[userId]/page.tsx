import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission, type RoleName } from "@/lib/auth/permissions";
import { getTeamMemberDetail } from "@/app/actions/team-overview";
import type { TeamOverviewScope } from "@/lib/team-hierarchy-types";
import { defaultLandingScopeForRole } from "@/lib/team-hierarchy-types";
import { TeamMemberDetailView } from "./TeamMemberDetailView";

export const dynamic = "force-dynamic";

export default async function TeamMemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ period?: string; scope?: string }>;
}) {
  const auth = await requireAuth();
  if (!hasPermission(auth.roleName as RoleName, "team_overview:read")) {
    redirect("/portal");
  }

  const { userId } = await params;
  const sp = (await searchParams) ?? {};
  const period =
    sp.period === "week" || sp.period === "month" || sp.period === "quarter" ? sp.period : "month";
  const scopeFromUrl: TeamOverviewScope | undefined =
    sp.scope === "me" || sp.scope === "my_team" || sp.scope === "full" ? sp.scope : undefined;
  const requestedScope = scopeFromUrl ?? defaultLandingScopeForRole(auth.roleName as RoleName);
  const detail = await getTeamMemberDetail(userId, { period, scope: requestedScope }).catch(() => null);
  if (!detail) notFound();

  const canCreateTeamCalendar = hasPermission(auth.roleName as RoleName, "team_calendar:write");
  const canEditTeamCareer = hasPermission(auth.roleName as RoleName, "team_members:write");

  return (
    <div className="min-h-screen bg-[var(--wp-bg)]">
      <div className="mx-auto max-w-5xl px-3 sm:px-6 lg:px-8 py-6 md:py-8">
        <Link
          href={(() => {
            const q = new URLSearchParams();
            if (period !== "month") q.set("period", period);
            q.set("scope", requestedScope);
            const qs = q.toString();
            return qs ? `/portal/team-overview?${qs}` : "/portal/team-overview";
          })()}
          className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--wp-text-secondary)] hover:text-indigo-600 mb-6"
        >
          ← Zpět na Týmový přehled
        </Link>
        <TeamMemberDetailView
          detail={detail}
          canCreateTeamCalendar={canCreateTeamCalendar}
          canEditTeamCareer={canEditTeamCareer}
        />
      </div>
    </div>
  );
}
