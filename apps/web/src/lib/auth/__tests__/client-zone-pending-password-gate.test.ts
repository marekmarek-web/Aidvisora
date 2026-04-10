import { describe, expect, it } from "vitest";
import {
  clientZoneSkipPendingPasswordGate,
  type ClientZonePendingGateMembership,
} from "@/lib/auth/client-zone-pending-gate";

describe("clientZoneSkipPendingPasswordGate", () => {
  it("returns true for Client with contactId", () => {
    const m: ClientZonePendingGateMembership = {
      roleName: "Client",
      contactId: "c1",
    };
    expect(clientZoneSkipPendingPasswordGate(m)).toBe(true);
  });

  it("returns false when Client has no contactId", () => {
    const m: ClientZonePendingGateMembership = {
      roleName: "Client",
      contactId: undefined,
    };
    expect(clientZoneSkipPendingPasswordGate(m)).toBe(false);
  });

  it("returns false for non-Client or null", () => {
    expect(
      clientZoneSkipPendingPasswordGate({
        roleName: "Admin",
        contactId: "c1",
      }),
    ).toBe(false);
    expect(clientZoneSkipPendingPasswordGate(null)).toBe(false);
  });
});
