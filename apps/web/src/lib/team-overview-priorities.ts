import type { TeamOverviewKpis, NewcomerAdaptation } from "@/app/actions/team-overview";
import type { TeamOverviewBriefingCopy } from "@/lib/team-overview-page-model";
import type { TeamRhythmComputed } from "@/lib/team-rhythm/compute-view";

export type TeamOverviewPriorityItem = { title: string; subtitle: string };

/**
 * Odvozuje 0–3 priority z reálných dat. Žádné vymyšlené počty — pokud signál není, řádek se nevykreslí.
 */
export function deriveTeamOverviewPriorities(input: {
  briefing: TeamOverviewBriefingCopy;
  newcomers: NewcomerAdaptation[];
  rhythm: TeamRhythmComputed | null;
  kpis: TeamOverviewKpis | null;
  scopeIsTeam: boolean;
}): TeamOverviewPriorityItem[] {
  const out: TeamOverviewPriorityItem[] = [];

  if (input.scopeIsTeam && input.briefing.attentionCount > 0) {
    const n = input.briefing.attentionCount;
    out.push({
      title: `${n} ${n === 1 ? "člověk vyžaduje" : "lidí vyžaduje"} pozornost (CRM / kariéra)`,
      subtitle: "Projděte sekci pozornosti a alerty níže.",
    });
  }

  if (input.scopeIsTeam && input.newcomers.length > 0) {
    const n = input.newcomers.length;
    out.push({
      title: `${n} ${n === 1 ? "nováček v adaptaci" : "nováčků v adaptaci"}`,
      subtitle: "Zkontrolujte rytmus check-inů a dokončení kroků.",
    });
  }

  const overdue = input.rhythm?.stats.overdueTeamTasks ?? 0;
  if (input.scopeIsTeam && overdue > 0) {
    out.push({
      title: `${overdue} týmových úkolů po termínu`,
      subtitle: "Vyřešte nebo přeplánujte v úkolech / kalendáři.",
    });
  }

  const cadenceAtt = input.rhythm?.stats.cadenceAttentionCount ?? 0;
  if (input.scopeIsTeam && out.length < 3 && cadenceAtt > 0) {
    out.push({
      title: `${cadenceAtt} ${cadenceAtt === 1 ? "osoba má" : "osob má"} signál v cadence vedení`,
      subtitle: "Viz týmový rytmus a doporučené navázání.",
    });
  }

  if (input.kpis && input.scopeIsTeam && out.length < 3 && input.kpis.meetingsThisWeek > 0) {
    out.push({
      title: `Tento týden: ${input.kpis.meetingsThisWeek} schůzek v CRM (tento rozsah)`,
      subtitle: `Období přehledu: ${input.kpis.periodLabel}.`,
    });
  }

  return out.slice(0, 3);
}
