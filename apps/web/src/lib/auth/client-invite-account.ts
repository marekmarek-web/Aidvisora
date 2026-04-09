"use server";

import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { db, memberships, roles, clientContacts, and, eq } from "db";

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const USERS_PER_PAGE = 200;
const MAX_USER_SCAN_PAGES = 20;

function randomPart(length: number) {
  return Array.from(crypto.getRandomValues(new Uint32Array(length)))
    .map((value) => TEMP_PASSWORD_ALPHABET[value % TEMP_PASSWORD_ALPHABET.length])
    .join("");
}

export async function generateClientInviteTemporaryPassword() {
  return `Aidv-${randomPart(4)}-${randomPart(4)}-${randomPart(2)}!`;
}

export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();

  for (let page = 1; page <= MAX_USER_SCAN_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === normalized) ?? null;
    if (user) return user;
    if (data.users.length < USERS_PER_PAGE) break;
  }

  return null;
}

async function assertExistingAuthUserIsSafe(userId: string, tenantId: string, contactId: string) {
  const membershipRows = await db
    .select({
      tenantId: memberships.tenantId,
      roleName: roles.name,
    })
    .from(memberships)
    .innerJoin(roles, eq(memberships.roleId, roles.id))
    .where(eq(memberships.userId, userId));

  if (membershipRows.some((row) => row.roleName !== "Client")) {
    throw new Error("Tento e-mail už používá poradenský účet. Použijte jiný e-mail klienta.");
  }

  const linkedContacts = await db
    .select({
      tenantId: clientContacts.tenantId,
      contactId: clientContacts.contactId,
    })
    .from(clientContacts)
    .where(eq(clientContacts.userId, userId));

  const hasDifferentLinkedContact = linkedContacts.some(
    (row) => row.tenantId !== tenantId || row.contactId !== contactId,
  );
  if (hasDifferentLinkedContact) {
    throw new Error("Tento e-mail je už propojený s jiným klientským účtem.");
  }
}

export async function provisionClientInviteAccount(params: {
  email: string;
  fullName?: string | null;
  tenantId: string;
  contactId: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = params.email.trim().toLowerCase();
  const temporaryPassword = await generateClientInviteTemporaryPassword();
  const existingUser = await findAuthUserByEmail(normalizedEmail);

  if (existingUser) {
    await assertExistingAuthUserIsSafe(existingUser.id, params.tenantId, params.contactId);
    const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        ...existingUser.user_metadata,
        full_name: params.fullName?.trim() || existingUser.user_metadata?.full_name || null,
      },
    });
    if (error) throw error;
    return {
      userId: existingUser.id,
      temporaryPassword,
      reusedExistingUser: true,
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: params.fullName?.trim() || null,
    },
  });
  if (error) throw error;
  if (!data.user) {
    throw new Error("Supabase account provisioning returned no user.");
  }

  return {
    userId: data.user.id,
    temporaryPassword,
    reusedExistingUser: false,
  };
}
