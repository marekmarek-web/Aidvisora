"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/permissions";
import { db, contacts, clientPaymentSetups, paymentAccounts, eq, and, isNull } from "db";
import { dedupeCzechAccountTrailingBankCode } from "@/lib/ai/payment-field-contract";

/**
 * F5: Pro danou instituci (provider) a segment zjistí, zda je variabilní symbol
 * povinný. Default `true` – jen známé výjimky (např. Conseq Active/Horizont
 * Invest, Conseq DPS účastník) ho mají `false` globální seed migrací. Tenant
 * override má přednost před globálním.
 *
 * V seedu může existovat více řádků pro stejnou (partner, segment) dvojici,
 * které se liší payment_type nebo product_code (např. Conseq INV má Active/Horizont
 * bez VS a zároveň Classic Invest s VS). Permisivní pravidlo: VS je NEpovinný,
 * jakmile aspoň jeden řádek tuto dvojici povoluje. Pokud poradce do formuláře
 * vyplní Conseq + INV a záměrně nevyplní VS, akceptujeme to — předpokládáme
 * Active/Horizont variantu.
 */
async function isVariableSymbolRequired(
  tenantId: string,
  providerName: string,
  segment: string,
): Promise<boolean> {
  const normalized = providerName.trim().toLowerCase();
  if (!normalized) return true;

  const tenantRows = (
    await db
      .select({
        partnerName: paymentAccounts.partnerName,
        variableSymbolRequired: paymentAccounts.variableSymbolRequired,
      })
      .from(paymentAccounts)
      .where(and(eq(paymentAccounts.tenantId, tenantId), eq(paymentAccounts.segment, segment)))
  ).filter((r) => r.partnerName && r.partnerName.trim().toLowerCase() === normalized);

  if (tenantRows.length > 0) {
    return tenantRows.every((r) => r.variableSymbolRequired);
  }

  const globalRows = (
    await db
      .select({
        partnerName: paymentAccounts.partnerName,
        variableSymbolRequired: paymentAccounts.variableSymbolRequired,
      })
      .from(paymentAccounts)
      .where(and(isNull(paymentAccounts.tenantId), eq(paymentAccounts.segment, segment)))
  ).filter((r) => r.partnerName && r.partnerName.trim().toLowerCase() === normalized);

  if (globalRows.length === 0) return true;
  return globalRows.every((r) => r.variableSymbolRequired);
}

/**
 * M12: normalize a human/date input to ISO `YYYY-MM-DD`. Accepts
 * `DD.MM.YYYY`, `YYYY-MM-DD`, or a full ISO string. Returns null if the
 * input cannot be parsed confidently (so we don't store "zítra" as-is).
 */
function normalizeDateToISO(input: string | null | undefined): string | null {
  if (!input) return null;
  const t = input.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const ddmmyyyy = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const dd = d!.padStart(2, "0");
    const mm = m!.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const d = String(parsed.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

export type ManualPaymentSetupInput = {
  contactId: string;
  providerName: string;
  productName?: string;
  segment: string;
  accountNumber: string;
  iban?: string;
  variableSymbol: string;
  constantSymbol?: string;
  specificSymbol?: string;
  amount?: string;
  /** ISO 4217 měna. Pokud není předána, default je CZK. */
  currency?: string;
  frequency?: string;
  firstPaymentDate?: string;
  visibleToClient: boolean;
};

const SUPPORTED_PAYMENT_CURRENCIES = new Set(["CZK", "EUR", "USD", "GBP", "PLN", "HUF", "CHF"]);

export type ManualPaymentSetupResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createManualPaymentSetup(
  input: ManualPaymentSetupInput
): Promise<ManualPaymentSetupResult> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:write")) {
    return { ok: false, error: "Nemáte oprávnění vytvářet platební instrukce." };
  }

  const { contactId } = input;

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, auth.tenantId)))
    .limit(1);

  if (!contact) {
    return { ok: false, error: "Kontakt nenalezen." };
  }

  const providerName = input.providerName.trim();
  if (!providerName) return { ok: false, error: "Název instituce je povinný." };

  const accountNumber = (input.iban?.trim() || input.accountNumber?.trim()) || null;
  if (!accountNumber) return { ok: false, error: "Číslo účtu nebo IBAN je povinné." };

  const variableSymbol = input.variableSymbol?.trim() || null;
  if (!variableSymbol) {
    const vsRequired = await isVariableSymbolRequired(auth.tenantId, providerName, input.segment);
    if (vsRequired) {
      return { ok: false, error: "Variabilní symbol je povinný." };
    }
  }

  // Parse amount: strip non-numeric characters except decimal separator
  let amountValue: string | null = null;
  if (input.amount?.trim()) {
    const numeric = parseFloat(input.amount.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!isNaN(numeric) && numeric > 0) {
      amountValue = String(numeric);
    }
  }

  // Determine if we store as iban field vs accountNumber/bankCode
  const ibanVal = input.iban?.trim() || null;
  let accountNumberField: string | null = null;
  let bankCodeField: string | null = null;

  if (!ibanVal && accountNumber) {
    const deduped = dedupeCzechAccountTrailingBankCode(accountNumber);
    const slashIdx = deduped.indexOf("/");
    if (slashIdx !== -1) {
      accountNumberField = deduped.substring(0, slashIdx).trim();
      bankCodeField = deduped.substring(slashIdx + 1).trim();
    } else {
      accountNumberField = deduped;
    }
  }

  // M11: dedup check — if an active payment setup already exists for the same
  // (tenant, contact, variableSymbol, account_or_iban) tuple, return the
  // existing id instead of creating a duplicate row. Matches both IBAN and
  // domestic account representations. F5: VS může být null (Conseq),
  // v takovém případě dedup pouze podle account/IBAN.
  const dedupConditions = [
    variableSymbol ? eq(clientPaymentSetups.variableSymbol, variableSymbol) : null,
    ibanVal
      ? eq(clientPaymentSetups.iban, ibanVal)
      : accountNumberField
        ? eq(clientPaymentSetups.accountNumber, accountNumberField)
        : null,
  ].filter((c): c is NonNullable<typeof c> => c != null);

  if (dedupConditions.length >= 2) {
    const [existing] = await db
      .select({ id: clientPaymentSetups.id })
      .from(clientPaymentSetups)
      .where(
        and(
          eq(clientPaymentSetups.tenantId, auth.tenantId),
          eq(clientPaymentSetups.contactId, contactId),
          eq(clientPaymentSetups.status, "active"),
          ...dedupConditions,
        ),
      )
      .limit(1);
    if (existing) {
      return { ok: true, id: existing.id };
    }
  }

  const [inserted] = await db
    .insert(clientPaymentSetups)
    .values({
      tenantId: auth.tenantId,
      contactId,
      status: "active",
      paymentType: mapSegmentToPaymentType(input.segment),
      segment: input.segment,
      providerName,
      productName: input.productName?.trim() || null,
      accountNumber: accountNumberField,
      bankCode: bankCodeField,
      iban: ibanVal,
      variableSymbol,
      constantSymbol: input.constantSymbol?.trim() || null,
      specificSymbol: input.specificSymbol?.trim() || null,
      amount: amountValue,
      currency: (() => {
        const raw = (input.currency ?? "").trim().toUpperCase();
        return raw && SUPPORTED_PAYMENT_CURRENCIES.has(raw) ? raw : "CZK";
      })(),
      frequency: input.frequency?.trim() || null,
      // M12: store a real ISO date or null, never an ambiguous human string.
      firstPaymentDate: normalizeDateToISO(input.firstPaymentDate ?? null),
      needsHumanReview: false,
      visibleToClient: input.visibleToClient,
    })
    .returning({ id: clientPaymentSetups.id });

  if (!inserted) return { ok: false, error: "Nepodařilo se uložit platební instrukci." };

  return { ok: true, id: inserted.id };
}

export type ManualPaymentSetupUpdateInput = ManualPaymentSetupInput & {
  /** ID existující platební instrukce, která se má přepsat. */
  id: string;
};

export async function updateManualPaymentSetup(
  input: ManualPaymentSetupUpdateInput
): Promise<ManualPaymentSetupResult> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:write")) {
    return { ok: false, error: "Nemáte oprávnění upravovat platební instrukce." };
  }

  const { id, contactId } = input;
  if (!id) return { ok: false, error: "Chybí ID platební instrukce." };

  const [existing] = await db
    .select({ id: clientPaymentSetups.id })
    .from(clientPaymentSetups)
    .where(
      and(
        eq(clientPaymentSetups.id, id),
        eq(clientPaymentSetups.tenantId, auth.tenantId),
        eq(clientPaymentSetups.contactId, contactId)
      )
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Platební instrukce nenalezena." };
  }

  const providerName = input.providerName.trim();
  if (!providerName) return { ok: false, error: "Název instituce je povinný." };

  const accountNumberRaw = (input.iban?.trim() || input.accountNumber?.trim()) || null;
  if (!accountNumberRaw) return { ok: false, error: "Číslo účtu nebo IBAN je povinné." };

  const variableSymbol = input.variableSymbol?.trim() || null;
  if (!variableSymbol) {
    const vsRequired = await isVariableSymbolRequired(auth.tenantId, providerName, input.segment);
    if (vsRequired) {
      return { ok: false, error: "Variabilní symbol je povinný." };
    }
  }

  let amountValue: string | null = null;
  if (input.amount?.trim()) {
    const numeric = parseFloat(input.amount.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!isNaN(numeric) && numeric > 0) {
      amountValue = String(numeric);
    }
  }

  const ibanVal = input.iban?.trim() || null;
  let accountNumberField: string | null = null;
  let bankCodeField: string | null = null;

  if (!ibanVal && accountNumberRaw) {
    const deduped = dedupeCzechAccountTrailingBankCode(accountNumberRaw);
    const slashIdx = deduped.indexOf("/");
    if (slashIdx !== -1) {
      accountNumberField = deduped.substring(0, slashIdx).trim();
      bankCodeField = deduped.substring(slashIdx + 1).trim();
    } else {
      accountNumberField = deduped;
    }
  }

  await db
    .update(clientPaymentSetups)
    .set({
      paymentType: mapSegmentToPaymentType(input.segment),
      segment: input.segment,
      providerName,
      productName: input.productName?.trim() || null,
      accountNumber: accountNumberField,
      bankCode: bankCodeField,
      iban: ibanVal,
      variableSymbol,
      constantSymbol: input.constantSymbol?.trim() || null,
      specificSymbol: input.specificSymbol?.trim() || null,
      amount: amountValue,
      currency: (() => {
        const raw = (input.currency ?? "").trim().toUpperCase();
        return raw && SUPPORTED_PAYMENT_CURRENCIES.has(raw) ? raw : "CZK";
      })(),
      frequency: input.frequency?.trim() || null,
      // M12: preserve ISO invariant on update path as well.
      firstPaymentDate: normalizeDateToISO(input.firstPaymentDate ?? null),
      visibleToClient: input.visibleToClient,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clientPaymentSetups.id, id),
        eq(clientPaymentSetups.tenantId, auth.tenantId),
        eq(clientPaymentSetups.contactId, contactId)
      )
    );

  return { ok: true, id };
}

export async function deleteManualPaymentSetup(
  id: string,
  contactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:write")) {
    return { ok: false, error: "Nemáte oprávnění." };
  }

  await db
    .delete(clientPaymentSetups)
    .where(
      and(
        eq(clientPaymentSetups.id, id),
        eq(clientPaymentSetups.tenantId, auth.tenantId),
        eq(clientPaymentSetups.contactId, contactId)
      )
    );

  return { ok: true };
}

export async function updatePaymentSetupVisibility(
  id: string,
  contactId: string,
  visibleToClient: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:write")) {
    return { ok: false, error: "Nemáte oprávnění." };
  }

  await db
    .update(clientPaymentSetups)
    .set({ visibleToClient, updatedAt: new Date() })
    .where(
      and(
        eq(clientPaymentSetups.id, id),
        eq(clientPaymentSetups.tenantId, auth.tenantId),
        eq(clientPaymentSetups.contactId, contactId)
      )
    );

  return { ok: true };
}

function mapSegmentToPaymentType(
  segment: string
): "insurance" | "investment" | "pension" | "contribution" | "loan" | "other" {
  switch (segment) {
    case "ZP":
    case "MAJ":
    case "ODP":
    case "ODP_ZAM":
    case "AUTO_PR":
    case "AUTO_HAV":
    case "CEST":
    case "FIRMA_POJ":
      return "insurance";
    case "INV":
    case "DIP":
      return "investment";
    case "DPS":
      return "pension";
    case "HYPO":
    case "UVER":
      return "loan";
    default:
      return "other";
  }
}
