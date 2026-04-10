import type { RoleName } from "@/shared/rolePermissions";

/** Minimální tvar membership pro rozhodnutí o přeskočení pending-password redirectu. */
export type ClientZonePendingGateMembership = {
  roleName: RoleName;
  contactId?: string | null;
};

/** Klient s propojeným kontaktem — nemá být vynucena cesta přes starou pozvánku bez dokončeného hesla. */
export function clientZoneSkipPendingPasswordGate(m: ClientZonePendingGateMembership | null): boolean {
  return m != null && (m.roleName as string) === "Client" && Boolean(m.contactId);
}
