import { describe, expect, it, vi, beforeEach } from "vitest";

const listUsersMock = vi.fn();
const updateUserByIdMock = vi.fn();
const createUserMock = vi.fn();

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        listUsers: listUsersMock,
        updateUserById: updateUserByIdMock,
        createUser: createUserMock,
      },
    },
  })),
}));

vi.mock("db", () => ({
  memberships: "memberships",
  roles: "roles",
  clientContacts: "clientContacts",
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn(),
}));

// withTenantContext/withUserContext pouští dotazy přes vlastní tx; pro unit test
// předáme mock tx, který má pouze `select` (stejný tvar jako v původním testu).
vi.mock("@/lib/db/with-tenant-context", () => ({
  withTenantContext: vi.fn(async (_opts: unknown, fn: (tx: unknown) => unknown) =>
    fn({ select: (...args: unknown[]) => selectMock(...args) }),
  ),
  withUserContext: vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
    fn({ select: (...args: unknown[]) => selectMock(...args) }),
  ),
}));

import { provisionClientInviteAccount } from "@/lib/auth/client-invite-account";

describe("provisionClientInviteAccount alreadyOnboarded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsersMock.mockResolvedValue({
      data: {
        users: [
          {
            id: "user-1",
            email: "client@test.cz",
            user_metadata: {},
          },
        ],
      },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ data: { user: {} }, error: null });
    createUserMock.mockResolvedValue({ data: { user: { id: "new" } }, error: null });

    let selectCall = 0;
    selectMock.mockImplementation(() => {
      const idx = selectCall;
      selectCall += 1;
      return {
        from: () => {
          if (idx === 0 || idx === 2) {
            return {
              innerJoin: () => ({
                where:
                  idx === 2
                    ? () => ({
                        limit: () => Promise.resolve([{ roleName: "Client" }]),
                      })
                    : () => Promise.resolve([{ roleName: "Client", tenantId: "tenant-1" }]),
              }),
            };
          }
          return {
            where:
              idx === 3
                ? () => ({
                    limit: () => Promise.resolve([{ contactId: "contact-1" }]),
                  })
                : () => Promise.resolve([{ tenantId: "tenant-1", contactId: "contact-1" }]),
          };
        },
      };
    });
  });

  it("does not pass password to updateUserById when client is fully onboarded", async () => {
    const result = await provisionClientInviteAccount({
      email: "client@test.cz",
      fullName: "Jan Test",
      tenantId: "tenant-1",
      contactId: "contact-1",
    });

    expect(result.alreadyOnboarded).toBe(true);
    expect(result.temporaryPassword).toBe("");
    expect(result.reusedExistingUser).toBe(true);
    expect(updateUserByIdMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        email: "client@test.cz",
        email_confirm: true,
      }),
    );
    const payload = updateUserByIdMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.password).toBeUndefined();
  });
});
