"use client";

/**
 * Karta pro ruční doplnění platební instrukce v AI Review.
 * Zobrazí se, když AI extrakce nenašla úplné platební údaje (nebo i vedle
 * úspěšného sync, jako sekundární akce — např. druhý účet).
 *
 * Prefill bere, co už AI extrakce našla, ať poradce nemusí opisovat to, co
 * systém zná. Uložení jde do stejného endpointu jako ruční evidence z detailu
 * kontaktu (`createManualPaymentSetup`), takže vznikne standardní záznam v
 * `client_payment_setups` a projeví se v klientském portálu i v přehledu
 * poradce.
 */

import { useMemo, useState } from "react";
import { Plus, Info, Wand2 } from "lucide-react";
import {
  ManualPaymentSetupModal,
  type ManualPaymentSetupPrefill,
} from "@/app/portal/contacts/[id]/ManualPaymentSetupModal";
import type { ExtractionDocument } from "@/lib/ai-review/types";

function getField(doc: ExtractionDocument, key: string): string {
  const targetId = `extractedFields.${key}`;
  for (const group of doc.groups ?? []) {
    for (const f of group.fields ?? []) {
      if (f.id === targetId) {
        const v = (f.manualValue ?? f.value ?? "").trim();
        if (v && v !== "—") return v;
      }
    }
  }
  return "";
}

function mapFrequencyLabel(raw: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v.includes("měsíč") || v.includes("mesic") || v.includes("monthly")) return "Měsíčně";
  if (v.includes("čtvrtlet") || v.includes("ctvrtlet") || v.includes("quarter")) return "Čtvrtletně";
  if (v.includes("pololet") || v.includes("semi")) return "Pololetně";
  if (v.includes("ročn") || v.includes("rocn") || v.includes("year") || v.includes("annual")) return "Ročně";
  if (v.includes("jednoráz") || v.includes("jednoraz") || v.includes("one") || v.includes("lump")) return "Jednorázově";
  return undefined;
}

function buildPrefill(doc: ExtractionDocument): ManualPaymentSetupPrefill {
  const providerName =
    getField(doc, "institutionName") ||
    getField(doc, "insurer") ||
    getField(doc, "provider") ||
    getField(doc, "platform");
  const productName = getField(doc, "productName");
  const variableSymbol =
    getField(doc, "variableSymbol") ||
    getField(doc, "contractNumber");
  const accountNumber =
    getField(doc, "recipientAccount") ||
    getField(doc, "bankAccount") ||
    getField(doc, "accountNumber");
  const bankCode = getField(doc, "bankCode");
  const iban = getField(doc, "iban");
  const constantSymbol = getField(doc, "constantSymbol");
  const specificSymbol = getField(doc, "specificSymbol");
  const amount =
    getField(doc, "investmentPremium") ||
    getField(doc, "contributionAmount") ||
    getField(doc, "regularAmount") ||
    getField(doc, "premiumAmount") ||
    getField(doc, "monthlyPremium") ||
    getField(doc, "totalMonthlyPremium") ||
    getField(doc, "installmentAmount") ||
    getField(doc, "annualPremium");
  const frequencyRaw =
    getField(doc, "paymentFrequency") ||
    getField(doc, "premiumFrequency");
  const firstPaymentDate =
    getField(doc, "firstPaymentDate") ||
    getField(doc, "firstInstallmentDate");

  return {
    ...(providerName ? { providerName } : {}),
    ...(productName ? { productName } : {}),
    ...(variableSymbol ? { variableSymbol } : {}),
    ...(accountNumber ? { accountNumber } : {}),
    ...(bankCode ? { bankCode } : {}),
    ...(iban ? { iban } : {}),
    ...(constantSymbol ? { constantSymbol } : {}),
    ...(specificSymbol ? { specificSymbol } : {}),
    ...(amount ? { amount } : {}),
    ...(frequencyRaw ? { frequency: mapFrequencyLabel(frequencyRaw) ?? frequencyRaw } : {}),
    ...(firstPaymentDate ? { firstPaymentDate } : {}),
  };
}

function resolveContactId(doc: ExtractionDocument): string | null {
  if (doc.matchedClientId) return doc.matchedClientId;
  const apply = doc.applyResultPayload;
  if (apply?.linkedClientId) return apply.linkedClientId;
  if (apply?.createdClientId) return apply.createdClientId;
  return null;
}

export function PaymentManualFillCard({ doc }: { doc: ExtractionDocument }) {
  const contactId = resolveContactId(doc);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<"idle" | "saved">("idle");

  const prefill = useMemo(() => buildPrefill(doc), [doc]);

  const previewStatus = doc.advisorReview?.paymentSyncPreview?.status;
  const isSyncReady = previewStatus === "will_sync";
  const isSkipped = previewStatus === "skipped_modelation";
  if (isSkipped) return null;

  const hasAnyPrefill = Object.values(prefill).some((v) => typeof v === "string" && v.length > 0);

  return (
    <>
      <div className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-900 mb-1.5 flex items-center gap-1.5">
          <Wand2 size={12} className="text-indigo-600" />
          {isSyncReady ? "Chcete doplnit další platbu?" : "Platební instrukce neúplné?"}
        </p>
        <p className="text-xs text-indigo-900/80 leading-snug mb-2">
          {isSyncReady
            ? "Můžete přidat další platební instrukci ručně (např. druhý účet, jiná frekvence)."
            : "AI mohla neúplně vyčíst platební údaje. Doplňte je ručně — uloží se jako standardní platební instrukce klienta."}
        </p>
        {contactId ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFlash("idle");
                setOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus size={12} />
              Doplnit platební instrukci ručně
            </button>
            {hasAnyPrefill ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-900/80">
                <Info size={10} />
                Formulář bude předvyplněn hodnotami z AI extrakce.
              </span>
            ) : null}
            {flash === "saved" ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                Uloženo — projeví se v klientském portálu.
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-indigo-900/80 italic">
            Nejprve propojte dokument s klientem (nebo vytvořte nového) — teprve pak lze připojit platební instrukci.
          </p>
        )}
      </div>
      {open && contactId ? (
        <ManualPaymentSetupModal
          contactId={contactId}
          prefill={prefill}
          onClose={() => setOpen(false)}
          onSaved={() => setFlash("saved")}
        />
      ) : null}
    </>
  );
}
