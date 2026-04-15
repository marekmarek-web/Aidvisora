/**
 * Advisor FK integrity for contract writes (manual + AI Review apply).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureUserProfileRowForAdvisor,
  formatContractAdvisorFkApplyError,
} from "../ensure-user-profile-for-contract-fk";

const insertMock = vi.fn();

vi.mock("db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => insertMock(),
      }),
    }),
  },
  userProfiles: { userId: "user_id" },
}));

describe("ensureUserProfileRowForAdvisor", () => {
  beforeEach(() => {
    insertMock.mockReset();
    insertMock.mockResolvedValue(undefined);
  });

  it("bez advisor id (prázdný string) — žádný DB dotaz", async () => {
    await ensureUserProfileRowForAdvisor("   ");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("s platným user id — UPSERT do user_profiles", async () => {
    await ensureUserProfileRowForAdvisor("  auth-user-uuid  ");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});

describe("formatContractAdvisorFkApplyError (truthful error state)", () => {
  it("maps Postgres advisor FK na srozumitelnou hlášku", () => {
    const msg = formatContractAdvisorFkApplyError(
      new Error(
        'insert or update on table "contracts" violates foreign key constraint "contracts_advisor_id_fkey"'
      )
    );
    expect(msg).toContain("Účet poradce");
  });

  it("confirmed_by_user_id FK — stejná uživatelská hláška", () => {
    expect(
      formatContractAdvisorFkApplyError(
        new Error('violates foreign key constraint "contracts_confirmed_by_user_id_fkey"')
      )
    ).toContain("Účet poradce");
  });

  it("ne-FK chyba — propustí originální text", () => {
    expect(formatContractAdvisorFkApplyError(new Error("unique violation on contracts"))).toContain(
      "unique violation"
    );
  });
});
