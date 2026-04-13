"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, UserCog } from "lucide-react";
import {
  listTenantMembers,
  sendTeamMemberInvitation,
  getTenantTeamCareerDefaults,
  setTenantTeamCareerDefaultProgram,
  removeMember,
} from "@/app/actions/team";
import { hasPermission, type RoleName } from "@/shared/rolePermissions";
import { normalizeCareerProgramFromDb } from "@/lib/career/registry";
import { TeamMemberCareerFields } from "@/app/portal/setup/TeamMemberCareerFields";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import { useToast } from "@/app/components/Toast";

export interface TeamManagementPanelProps {
  currentUserId: string;
  currentUserEmail: string;
  currentUserFullName: string | null;
  roleName: string;
}

export function TeamManagementPanel({
  currentUserId,
  currentUserEmail,
  currentUserFullName,
  roleName,
}: TeamManagementPanelProps) {
  const toast = useToast();
  const canManageTeamCareer = hasPermission(roleName as RoleName, "team_members:write");

  const resolvedCareerProgramForMember = useCallback((raw: string | null) => {
    const { programId } = normalizeCareerProgramFromDb(raw);
    return programId === "beplan" || programId === "premium_brokers" ? programId : null;
  }, []);

  const [teamMembers, setTeamMembers] = useState<Awaited<ReturnType<typeof listTenantMembers>>>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Advisor");
  const [inviteSending, setInviteSending] = useState(false);
  const [tenantDefaultCareerProgram, setTenantDefaultCareerProgram] = useState<
    "__none__" | "beplan" | "premium_brokers"
  >("__none__");
  const [tenantDefaultSaving, setTenantDefaultSaving] = useState(false);

  useEffect(() => {
    listTenantMembers().then(setTeamMembers).catch(() => setTeamMembers([]));
  }, []);

  useEffect(() => {
    void getTenantTeamCareerDefaults().then((d) => {
      const p = d.defaultCareerProgram;
      setTenantDefaultCareerProgram(p === "beplan" || p === "premium_brokers" ? p : "__none__");
    });
  }, []);

  return (
    <section
      id="sprava-tymu"
      className="scroll-mt-24 mb-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.06)] animate-in fade-in duration-300"
      aria-labelledby="team-management-heading"
    >
      <div className="border-b border-slate-200/80 px-6 py-6 sm:px-8">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Admin surface</p>
        <h2 id="team-management-heading" className="mb-1 text-xl font-black text-slate-900">
          Správa týmu
        </h2>
        <p className="text-sm font-medium text-slate-600">
          Spolupracujte na klientech se svými asistenty nebo kolegy.
        </p>
      </div>

      {canManageTeamCareer ? (
        <div className="border-b border-[color:var(--wp-surface-card-border)] bg-slate-50/70 px-6 py-5 sm:px-8">
          <p className="mb-2 text-xs font-bold text-[color:var(--wp-text-secondary)]">
            Výchozí kariérní program pro workspace — předvyplní se u členů bez uloženého programu (nepřepisuje jejich
            údaje).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tenantDefaultCareerProgram}
              onChange={(e) =>
                setTenantDefaultCareerProgram(e.target.value as "beplan" | "premium_brokers" | "__none__")
              }
              className="min-h-[40px] rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3 py-2 text-sm font-medium"
            >
              <option value="__none__">Žádný výchozí</option>
              <option value="beplan">Beplan</option>
              <option value="premium_brokers">Premium Brokers</option>
            </select>
            <button
              type="button"
              disabled={tenantDefaultSaving}
              onClick={async () => {
                setTenantDefaultSaving(true);
                try {
                  const res = await setTenantTeamCareerDefaultProgram(
                    tenantDefaultCareerProgram === "__none__" ? null : tenantDefaultCareerProgram
                  );
                  if (!res.ok) toast.showToast(res.error ?? "Uložení se nezdařilo.", "error");
                  else toast.showToast("Výchozí kariérní program uložen.");
                } finally {
                  setTenantDefaultSaving(false);
                }
              }}
              className="min-h-[40px] rounded-xl bg-[#16192b] px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
            >
              {tenantDefaultSaving ? "Ukládám…" : "Uložit výchozí"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-b border-[color:var(--wp-surface-card-border)] bg-[#16192b] px-6 py-5 text-white sm:px-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[color:var(--wp-text-secondary)]">
          Pozvat nového člena
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!inviteEmail.trim()) return;
            setInviteSending(true);
            try {
              const result = await sendTeamMemberInvitation(inviteEmail.trim(), inviteRole);
              if (!result.ok) {
                toast.showToast(result.error, "error");
                return;
              }
              if (result.emailSent) {
                toast.showToast(`Pozvánka odeslána na ${inviteEmail.trim()}`);
              } else {
                toast.showToast(
                  result.emailError
                    ? `Pozvánka uložena, ale e-mail se nepodařilo odeslat (${result.emailError}). Odkaz: ${result.inviteLink}`
                    : `Pozvánka uložena. Odkaz: ${result.inviteLink}`,
                  "error"
                );
              }
              setInviteEmail("");
              void listTenantMembers().then(setTeamMembers).catch(() => {});
            } catch {
              toast.showToast("Pozvánku se nepodařilo vytvořit.", "error");
            } finally {
              setInviteSending(false);
            }
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@kolegy.cz"
            className="min-h-[44px] min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white placeholder:text-slate-500 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
            required
          />
          <CustomDropdown
            value={inviteRole}
            onChange={setInviteRole}
            options={[
              { id: "Advisor", label: "Poradce" },
              { id: "Manager", label: "Manažer" },
              { id: "Viewer", label: "Prohlížeč" },
              { id: "Admin", label: "Admin" },
            ]}
            placeholder="Role"
            icon={UserCog}
          />
          <button
            type="submit"
            disabled={inviteSending || !inviteEmail.trim()}
            className="min-h-[44px] rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#16192b] transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {inviteSending ? "Odesílám…" : "Pozvat"}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        {teamMembers.length === 0 ? (
          <div className="p-8 text-center text-[color:var(--wp-text-secondary)]">
            <Users className="mx-auto mb-3 h-12 w-12 text-[color:var(--wp-text-tertiary)]" />
            <p className="font-medium">Zatím žádní další členové.</p>
            <p className="mt-1 text-sm">Pozvěte prvního člena tlačítkem výše.</p>
          </div>
        ) : (
          <table className="w-full min-w-[500px] text-left">
            <thead>
              <tr className="border-b border-[color:var(--wp-surface-card-border)] bg-slate-50/70">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] sm:px-8">
                  Uživatel
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                  Role
                </th>
                <th className="hidden px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] md:table-cell">
                  Připojení
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] sm:px-8">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((m) => {
                const isCurrentUser = m.userId === currentUserId;
                const displayName = isCurrentUser ? (currentUserFullName || currentUserEmail || "—") : "Člen týmu";
                const displayEmail = isCurrentUser ? currentUserEmail : "—";
                const initials =
                  isCurrentUser && currentUserFullName
                    ? [currentUserFullName.trim().split(/\s+/)[0]?.[0], currentUserFullName.trim().split(/\s+/).pop()?.[0]]
                        .filter(Boolean)
                        .join("")
                        .toUpperCase()
                    : (displayEmail.slice(0, 2).toUpperCase() || "?");
                return (
                  <tr key={m.membershipId} className="border-b border-[color:var(--wp-surface-card-border)]/50">
                    <td className="px-6 py-5 sm:px-8">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-black text-white">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-[color:var(--wp-text)]">{displayName}</div>
                          <div className="text-xs font-medium text-[color:var(--wp-text-secondary)]">{displayEmail}</div>
                        </div>
                      </div>
                      {canManageTeamCareer ? (
                        <TeamMemberCareerFields
                          key={`${m.membershipId}-${m.careerProgram ?? ""}-${m.careerTrack ?? ""}-${m.careerPositionCode ?? ""}`}
                          membershipId={m.membershipId}
                          initialProgram={resolvedCareerProgramForMember(m.careerProgram)}
                          initialTrack={m.careerTrack}
                          initialPosition={m.careerPositionCode}
                          careerHasLegacyProgram={m.careerHasLegacyProgram}
                          tenantDefaultProgram={
                            tenantDefaultCareerProgram === "__none__" ? null : tenantDefaultCareerProgram
                          }
                          onSaved={() => void listTenantMembers().then(setTeamMembers).catch(() => {})}
                        />
                      ) : null}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                          m.roleName === "Admin" ? "bg-slate-800 text-white" : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)]"
                        }`}
                      >
                        {m.roleName === "Admin" ? "Vlastník" : m.roleName}
                      </span>
                    </td>
                    <td className="hidden px-6 py-5 text-sm font-bold text-[color:var(--wp-text-secondary)] md:table-cell">
                      {new Date(m.joinedAt).toLocaleDateString("cs-CZ")}
                    </td>
                    <td className="px-6 py-5 text-right text-[color:var(--wp-text-tertiary)] sm:px-8">
                      {isCurrentUser ? (
                        "—"
                      ) : (
                        <button
                          type="button"
                          className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline"
                          onClick={async () => {
                            const confirmed = window.confirm(`Opravdu chcete odebrat tohoto člena z workspace?`);
                            if (!confirmed) return;
                            const res = await removeMember(m.membershipId);
                            if (res.ok) {
                              toast.showToast("Člen byl odebrán.");
                              setTeamMembers((prev) => prev.filter((x) => x.membershipId !== m.membershipId));
                            } else {
                              toast.showToast(res.error ?? "Odebrání se nezdařilo.", "error");
                            }
                          }}
                        >
                          Odebrat
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
