/**
 * FA → CRM contact sync: deduplicate, map, and prepare sync preview.
 */

import type { FinancialAnalysisData, ClientInfo, PartnerInfo, ChildEntry } from "./types";
import { splitFullName, parseFaBirthDateToIso } from "@/lib/analyses/financial/faNameUtils";

export type FaSyncPersonRole = "primary" | "partner" | "child";

export interface FaSyncPersonPreview {
  faRole: FaSyncPersonRole;
  faIndex?: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  personalId?: string;
  occupation?: string;
  sports?: string;
  matchedContactId?: string;
  matchReason?: string;
  selected: boolean;
  /** Věk v letech odvozený z birthDate (pokud lze spočítat). */
  age?: number;
  /** Rok narození (YYYY) – pro zobrazení u dětí <18. */
  birthYear?: number;
}

export interface FaSyncPreview {
  persons: FaSyncPersonPreview[];
  createHousehold: boolean;
  householdName: string;
  existingHouseholdId?: string;
  createCompany: boolean;
  companyIco?: string;
  companyName?: string;
  existingCompanyId?: string;
}

function normalizePhone(raw?: string): string {
  if (!raw) return "";
  return raw.replace(/[\s\-\(\)]/g, "").replace(/^\+420/, "");
}

function computeAgeFromIsoBirthDate(iso?: string): { age?: number; birthYear?: number } {
  if (!iso) return {};
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return {};
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (!Number.isFinite(year)) return {};
  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return { age: age >= 0 ? age : 0, birthYear: year };
}

function mapPersonInfo(
  info: { name?: string; birthDate?: string; birthNumber?: string; email?: string; phone?: string; occupation?: string; sports?: string },
): Omit<FaSyncPersonPreview, "faRole" | "faIndex" | "matchedContactId" | "matchReason" | "selected"> {
  const { firstName, lastName } = splitFullName(info.name ?? "");
  const birthDate = parseFaBirthDateToIso(info.birthDate ?? "") ?? undefined;
  const { age, birthYear } = computeAgeFromIsoBirthDate(birthDate);
  return {
    firstName,
    lastName,
    email: info.email?.trim() || undefined,
    phone: info.phone?.trim() || undefined,
    birthDate,
    personalId: (info.birthNumber ?? "").trim() || undefined,
    occupation: (info.occupation ?? "").trim() || undefined,
    sports: (info.sports ?? "").trim() || undefined,
    age,
    birthYear,
  };
}

export type ExistingContactForDedup = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  personalId: string | null;
};

export function findDuplicate(
  person: FaSyncPersonPreview,
  existing: ExistingContactForDedup[]
): { contactId: string; reason: string } | null {
  if (person.personalId) {
    const match = existing.find((c) => c.personalId && c.personalId === person.personalId);
    if (match) return { contactId: match.id, reason: "rodné číslo" };
  }
  if (person.email) {
    const match = existing.find((c) => c.email && c.email.toLowerCase() === person.email!.toLowerCase());
    if (match) return { contactId: match.id, reason: "e-mail" };
  }
  if (person.phone) {
    const normPerson = normalizePhone(person.phone);
    if (normPerson.length >= 6) {
      const match = existing.find((c) => c.phone && normalizePhone(c.phone) === normPerson);
      if (match) return { contactId: match.id, reason: "telefon" };
    }
  }
  if (person.firstName && person.lastName && person.birthDate) {
    const match = existing.find(
      (c) =>
        c.firstName.toLowerCase() === person.firstName.toLowerCase() &&
        c.lastName.toLowerCase() === person.lastName.toLowerCase() &&
        c.birthDate === person.birthDate
    );
    if (match) return { contactId: match.id, reason: "jméno + datum narození" };
  }
  return null;
}

export function buildSyncPreview(
  data: FinancialAnalysisData,
  existingContacts: ExistingContactForDedup[],
  existingHouseholdId?: string,
  existingCompanyId?: string,
): FaSyncPreview {
  const persons: FaSyncPersonPreview[] = [];

  const clientInfo = mapPersonInfo(data.client);
  const clientPreview: FaSyncPersonPreview = {
    ...clientInfo,
    faRole: "primary",
    selected: true,
  };
  const clientDup = findDuplicate(clientPreview, existingContacts);
  if (clientDup) {
    clientPreview.matchedContactId = clientDup.contactId;
    clientPreview.matchReason = clientDup.reason;
  }
  persons.push(clientPreview);

  if (data.client.hasPartner && data.partner?.name?.trim()) {
    const partnerInfo = mapPersonInfo(data.partner);
    const partnerPreview: FaSyncPersonPreview = {
      ...partnerInfo,
      faRole: "partner",
      selected: true,
    };
    const partnerDup = findDuplicate(partnerPreview, existingContacts);
    if (partnerDup) {
      partnerPreview.matchedContactId = partnerDup.contactId;
      partnerPreview.matchReason = partnerDup.reason;
    }
    persons.push(partnerPreview);
  }

  (data.children ?? []).forEach((child, idx) => {
    if (!child.name?.trim()) return;
    const childInfo = mapPersonInfo(child);
    const isAdult = typeof childInfo.age === "number" ? childInfo.age >= 18 : false;
    const childPreview: FaSyncPersonPreview = {
      ...childInfo,
      faRole: "child",
      faIndex: idx,
      selected: isAdult,
    };
    const childDup = findDuplicate(childPreview, existingContacts);
    if (childDup) {
      childPreview.matchedContactId = childDup.contactId;
      childPreview.matchReason = childDup.reason;
    }
    persons.push(childPreview);
  });

  const clientName = data.client.name?.trim() || "Domácnost";
  const householdName = `Domácnost ${clientName}`;

  return {
    persons,
    createHousehold: persons.length > 1 && !existingHouseholdId,
    householdName,
    existingHouseholdId,
    createCompany: Boolean(data.includeCompany),
    companyIco: undefined,
    companyName: undefined,
    existingCompanyId,
  };
}
