"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import { contacts } from "db";
import { eq, and, lte, isNotNull } from "db";

export type ServiceReminderContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  nextServiceDue: string | null;
};

export async function getContactsWithUpcomingService(): Promise<ServiceReminderContact[]> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:read")) throw new Error("Forbidden");
  const today = new Date().toISOString().slice(0, 10);
  return withTenantContextFromAuth(auth, async (tx) =>
    tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        nextServiceDue: contacts.nextServiceDue,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, auth.tenantId),
          isNotNull(contacts.nextServiceDue),
          lte(contacts.nextServiceDue, today)
        )
      ),
  );
}

export async function updateContactService(
  contactId: string,
  form: { serviceCycleMonths?: string; lastServiceDate?: string; nextServiceDue?: string }
) {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:write")) throw new Error("Forbidden");
  await withTenantContextFromAuth(auth, async (tx) => {
    await tx
      .update(contacts)
      .set({
        ...(form.serviceCycleMonths != null && { serviceCycleMonths: form.serviceCycleMonths || null }),
        ...(form.lastServiceDate != null && { lastServiceDate: form.lastServiceDate || null }),
        ...(form.nextServiceDue != null && { nextServiceDue: form.nextServiceDue || null }),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.tenantId, auth.tenantId), eq(contacts.id, contactId)));
  });
}
