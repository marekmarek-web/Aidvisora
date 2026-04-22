/**
 * Delta A7 — Ownership transfer při offboardingu člena týmu.
 *
 * Kontext: `removeMember` v `actions/team.ts` pouze mazal membership row. Tím vznikaly:
 *   - Úkoly přiřazené zmizelému user_id (nikdo je nevidí jako "své").
 *   - Events s `assigned_to` na zombie user.
 *   - Opportunities / pipeline s `assigned_to` → nezobrazují se v Pipeline view nikoho.
 *   - Meeting notes / proposals / calculator runs s `created_by` na zombie.
 *   - Aktivní Google integrace (Drive/Gmail/Calendar) s platnými OAuth tokeny bývalého člena.
 *
 * Tento modul poskytuje:
 *   1. `previewOffboarding(tenantId, userId)` → vrátí shrnutí, co se bude převádět / mazat.
 *   2. `executeOffboarding(tenantId, userId, newOwnerUserId)` → atomicky převede přiřazení
 *      a **zároveň** odvolá všechny user-bound integrace (tokeny, devices).
 *
 * Důležité rozhodnutí: **`created_by` se NEPŘEPISUJE** — je to historický fakt (kdo vytvořil
 * záznam). Pouze `assigned_to` a `user_id` (pro owner-scoped rows) se přesouvá. Výjimka:
 * pro advisor_business_plan / advisor_vision_goals / advisor_preferences platí, že jsou
 * striktně osobní → NEMIGRUJÍ se, pouze zmizí membership. Data zůstanou v DB jako historie
 * ale nikdo k nim nepřistoupí (RLS je vázáno na user_id == auth.uid()).
 */

import { and, eq, sql } from "drizzle-orm";
import {
  memberships,
  tasks,
  events,
  opportunities,
  contracts,
  userGoogleDriveIntegrations,
  userGoogleGmailIntegrations,
  userGoogleCalendarIntegrations,
  userDevices,
} from "db";

import { withTenantContext } from "@/lib/db/with-tenant-context";

export type OffboardingPreview = {
  tenantId: string;
  userId: string;
  counts: {
    tasksAssigned: number;
    eventsAssigned: number;
    opportunitiesAssigned: number;
    contractsAdvised: number;
    googleDriveIntegrations: number;
    googleGmailIntegrations: number;
    googleCalendarIntegrations: number;
    pushDevices: number;
  };
  eligibleSuccessors: Array<{ userId: string; displayName: string | null; email: string | null }>;
};

/**
 * Spočítá, co všechno se při removu tohoto user_id musí přeřadit / odvolat.
 * Používá se v modalu "Opravdu odebrat?" pro vizualizaci dopadu.
 */
export async function previewOffboarding(
  tenantId: string,
  userId: string,
): Promise<OffboardingPreview["counts"]> {
  return withTenantContext({ tenantId }, async (tx) => {
    const [tasksRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), eq(tasks.assignedTo, userId)));

    const [eventsRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.assignedTo, userId)));

    const [oppsRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(and(eq(opportunities.tenantId, tenantId), eq(opportunities.assignedTo, userId)));

    // B2.5 — pre-launch kontrakty preview: offboarding musí ukázat, kolik
    // smluv změní pečujícího poradce. Bez tohoto byla business-plan metrics
    // zamrzlá na bývalém člena i po jeho odchodu.
    const [contractsRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.advisorId, userId)));

    const driveRows = await tx
      .select({ id: userGoogleDriveIntegrations.userId })
      .from(userGoogleDriveIntegrations)
      .where(
        and(
          eq(userGoogleDriveIntegrations.tenantId, tenantId),
          eq(userGoogleDriveIntegrations.userId, userId),
        ),
      );

    const gmailRows = await tx
      .select({ id: userGoogleGmailIntegrations.userId })
      .from(userGoogleGmailIntegrations)
      .where(
        and(
          eq(userGoogleGmailIntegrations.tenantId, tenantId),
          eq(userGoogleGmailIntegrations.userId, userId),
        ),
      );

    const calRows = await tx
      .select({ id: userGoogleCalendarIntegrations.userId })
      .from(userGoogleCalendarIntegrations)
      .where(
        and(
          eq(userGoogleCalendarIntegrations.tenantId, tenantId),
          eq(userGoogleCalendarIntegrations.userId, userId),
        ),
      );

    const devicesRows = await tx
      .select({ id: userDevices.userId })
      .from(userDevices)
      .where(and(eq(userDevices.tenantId, tenantId), eq(userDevices.userId, userId)));

    return {
      tasksAssigned: tasksRow?.count ?? 0,
      eventsAssigned: eventsRow?.count ?? 0,
      opportunitiesAssigned: oppsRow?.count ?? 0,
      contractsAdvised: contractsRow?.count ?? 0,
      googleDriveIntegrations: driveRows.length,
      googleGmailIntegrations: gmailRows.length,
      googleCalendarIntegrations: calRows.length,
      pushDevices: devicesRows.length,
    };
  });
}

export type OffboardingResult = {
  ok: true;
  reassigned: {
    tasks: number;
    events: number;
    opportunities: number;
    contracts: number;
  };
  revoked: { drive: number; gmail: number; calendar: number; devices: number };
};

/**
 * Atomicky:
 *   - přepíše `assigned_to = newOwnerUserId` v tasks / events / opportunities,
 *   - smaže Google OAuth integrace (tokeny!) a push devices bývalého člena,
 *   - **nemění** `created_by` (historický fakt),
 *   - **nemaže** advisor_business_plan / vision_goals / preferences (osobní, RLS-chráněno).
 *
 * Caller (removeMember) je zodpovědný za:
 *   - ověření oprávnění (team_members:write),
 *   - ověření, že newOwnerUserId je jiný aktivní member ve stejném tenantu,
 *   - audit log entry,
 *   - smazání membership row PO úspěšném offboardingu.
 */
export async function executeOffboarding(
  tenantId: string,
  departingUserId: string,
  newOwnerUserId: string,
): Promise<OffboardingResult> {
  if (departingUserId === newOwnerUserId) {
    throw new Error("newOwnerUserId must differ from departing user");
  }

  return withTenantContext({ tenantId }, async (tx) => {
    const [successor] = await tx
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, newOwnerUserId)))
      .limit(1);

    if (!successor) {
      throw new Error("Successor is not a member of this tenant");
    }

    const tasksResult = await tx
      .update(tasks)
      .set({ assignedTo: newOwnerUserId, updatedAt: new Date() })
      .where(and(eq(tasks.tenantId, tenantId), eq(tasks.assignedTo, departingUserId)))
      .returning({ id: tasks.id });

    const eventsResult = await tx
      .update(events)
      .set({ assignedTo: newOwnerUserId, updatedAt: new Date() })
      .where(and(eq(events.tenantId, tenantId), eq(events.assignedTo, departingUserId)))
      .returning({ id: events.id });

    const oppsResult = await tx
      .update(opportunities)
      .set({ assignedTo: newOwnerUserId, updatedAt: new Date() })
      .where(
        and(eq(opportunities.tenantId, tenantId), eq(opportunities.assignedTo, departingUserId)),
      )
      .returning({ id: opportunities.id });

    // B2.5 — servicing advisor přesun. Varianta (A) z plánu: bez nové
    // `servicing_advisor_id` column přepisujeme `advisorId` přímo, protože
    // business-plan / analytics joinují přes advisorId a bez rewrite by
    // metriky bývalého člena zůstaly zamrzlé. `created_by` / originující
    // advisor historie se neztrácí (ai_review ukládá do `source_*` polí).
    const contractsResult = await tx
      .update(contracts)
      .set({ advisorId: newOwnerUserId, updatedAt: new Date() })
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.advisorId, departingUserId)))
      .returning({ id: contracts.id });

    const driveDeleted = await tx
      .delete(userGoogleDriveIntegrations)
      .where(
        and(
          eq(userGoogleDriveIntegrations.tenantId, tenantId),
          eq(userGoogleDriveIntegrations.userId, departingUserId),
        ),
      )
      .returning({ userId: userGoogleDriveIntegrations.userId });

    const gmailDeleted = await tx
      .delete(userGoogleGmailIntegrations)
      .where(
        and(
          eq(userGoogleGmailIntegrations.tenantId, tenantId),
          eq(userGoogleGmailIntegrations.userId, departingUserId),
        ),
      )
      .returning({ userId: userGoogleGmailIntegrations.userId });

    const calDeleted = await tx
      .delete(userGoogleCalendarIntegrations)
      .where(
        and(
          eq(userGoogleCalendarIntegrations.tenantId, tenantId),
          eq(userGoogleCalendarIntegrations.userId, departingUserId),
        ),
      )
      .returning({ userId: userGoogleCalendarIntegrations.userId });

    const devicesDeleted = await tx
      .delete(userDevices)
      .where(and(eq(userDevices.tenantId, tenantId), eq(userDevices.userId, departingUserId)))
      .returning({ userId: userDevices.userId });

    return {
      ok: true,
      reassigned: {
        tasks: tasksResult.length,
        events: eventsResult.length,
        opportunities: oppsResult.length,
        contracts: contractsResult.length,
      },
      revoked: {
        drive: driveDeleted.length,
        gmail: gmailDeleted.length,
        calendar: calDeleted.length,
        devices: devicesDeleted.length,
      },
    };
  });
}
