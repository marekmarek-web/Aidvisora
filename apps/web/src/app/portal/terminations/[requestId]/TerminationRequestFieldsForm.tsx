"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { segmentLabel } from "@/app/lib/segment-labels";
import {
  updateTerminationRequestFieldsAndReevaluateAction,
  type TerminationRequestDetail,
} from "@/app/actions/terminations";
import type { TerminationMode } from "@/lib/db/schema-for-client";
import { modeToReasonCode } from "@/lib/terminations/client";
import type { TerminationPolicyholderKind } from "@/lib/terminations/termination-document-extras";
import { parseDocumentBuilderExtras } from "@/lib/terminations/termination-document-extras";
import { FriendlyDateInput } from "@/components/forms/FriendlyDateInput";

const MODE_OPTIONS: { value: TerminationMode; label: string }[] = [
  { value: "end_of_insurance_period", label: "Ke konci pojistného období / výročnímu dni" },
  { value: "fixed_calendar_date", label: "K určitému datu" },
  { value: "within_two_months_from_inception", label: "Do 2 měsíců od sjednání" },
  { value: "after_claim", label: "Po pojistné události" },
  { value: "distance_withdrawal", label: "Odstoupení od smlouvy na dálku" },
  { value: "mutual_agreement", label: "Dohodou" },
  { value: "manual_review_other", label: "Jiný důvod / ruční posouzení" },
];

type Props = {
  requestId: string;
  detail: TerminationRequestDetail;
  segments: string[];
  onApplied: () => void;
};

export function TerminationRequestFieldsForm({ requestId, detail, segments, onApplied }: Props) {
  const r = detail.request;
  const extras0 = parseDocumentBuilderExtras(r.documentBuilderExtras);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [insurerName, setInsurerName] = useState(r.insurerName);
  const [contractNumber, setContractNumber] = useState(r.contractNumber ?? "");
  const [productSegment, setProductSegment] = useState(r.productSegment ?? segments[0] ?? "ZP");
  const [contractStartDate, setContractStartDate] = useState(r.contractStartDate ?? "");
  const [contractAnniversaryDate, setContractAnniversaryDate] = useState(r.contractAnniversaryDate ?? "");
  const [requestedEffectiveDate, setRequestedEffectiveDate] = useState(r.requestedEffectiveDate ?? "");
  const [sourceDocumentId, setSourceDocumentId] = useState(r.sourceDocumentId ?? "");
  const [terminationMode, setTerminationMode] = useState<TerminationMode>(r.terminationMode);
  const terminationReasonCode = useMemo(() => modeToReasonCode(terminationMode), [terminationMode]);
  const [uncertainInsurer, setUncertainInsurer] = useState(extras0.uncertainInsurer === true);
  const [policyholderKind, setPolicyholderKind] = useState<TerminationPolicyholderKind>(
    extras0.policyholderKind === "company" ? "company" : "person"
  );
  const [companyName, setCompanyName] = useState(extras0.companyName ?? "");
  const [authorizedPersonName, setAuthorizedPersonName] = useState(extras0.authorizedPersonName ?? "");
  const [authorizedPersonRole, setAuthorizedPersonRole] = useState(extras0.authorizedPersonRole ?? "");
  const [advisorNoteForReview, setAdvisorNoteForReview] = useState(extras0.advisorNoteForReview ?? "");
  const [claimEventDate, setClaimEventDate] = useState(extras0.claimEventDate ?? "");
  const [placeOverride, setPlaceOverride] = useState(extras0.placeOverride ?? "");
  const onSegmentPick = useCallback((seg: string) => {
    setProductSegment(seg);
  }, []);

  const onSave = useCallback(() => {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await updateTerminationRequestFieldsAndReevaluateAction({
        requestId,
        insurerName: insurerName.trim(),
        contractNumber: contractNumber.trim() || null,
        productSegment: productSegment.trim() || null,
        contractStartDate: contractStartDate.trim() || null,
        contractAnniversaryDate: contractAnniversaryDate.trim() || null,
        requestedEffectiveDate: requestedEffectiveDate.trim() || null,
        sourceDocumentId: sourceDocumentId.trim() || null,
        terminationMode,
        terminationReasonCode,
        uncertainInsurer,
        documentBuilderExtras: {
          ...(policyholderKind === "company" ? { policyholderKind: "company" as const } : {}),
          ...(policyholderKind === "company" && companyName.trim() ? { companyName: companyName.trim() } : {}),
          ...(policyholderKind === "company" && authorizedPersonName.trim()
            ? { authorizedPersonName: authorizedPersonName.trim() }
            : {}),
          ...(policyholderKind === "company" && authorizedPersonRole.trim()
            ? { authorizedPersonRole: authorizedPersonRole.trim() }
            : {}),
          ...(advisorNoteForReview.trim() ? { advisorNoteForReview: advisorNoteForReview.trim() } : {}),
          ...(claimEventDate.trim() ? { claimEventDate: claimEventDate.trim() } : {}),
          ...(placeOverride.trim() ? { placeOverride: placeOverride.trim() } : {}),
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOkMsg("Pole uložena a pravidla znovu vyhodnocena.");
      onApplied();
    });
  }, [
    requestId,
    insurerName,
    contractNumber,
    productSegment,
    contractStartDate,
    contractAnniversaryDate,
    requestedEffectiveDate,
    sourceDocumentId,
    terminationMode,
    terminationReasonCode,
    uncertainInsurer,
    policyholderKind,
    companyName,
    authorizedPersonName,
    authorizedPersonRole,
    advisorNoteForReview,
    claimEventDate,
    placeOverride,
    onApplied,
  ]);

  return (
    <section className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-4 space-y-3">
      <h2 className="text-sm font-bold text-[color:var(--wp-text)]">Úprava údajů žádosti</h2>
      <p className="text-xs text-[color:var(--wp-text-secondary)]">
        Změna polí spustí znovu rules engine a přegeneruje řádky požadovaných příloh.
      </p>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-[var(--wp-radius)] px-3 py-2">
          {okMsg}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Pojišťovna</label>
          <input
            value={insurerName}
            onChange={(e) => setInsurerName(e.target.value)}
            className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={uncertainInsurer}
            onChange={(e) => setUncertainInsurer(e.target.checked)}
            className="h-4 w-4"
          />
          Nejistá pojišťovna → review
        </label>
        <div>
          <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Číslo smlouvy</label>
          <input
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Segment</label>
          <select
            value={productSegment}
            onChange={(e) => void onSegmentPick(e.target.value)}
            className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
          >
            {segments.map((s) => (
              <option key={s} value={s}>
                {segmentLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <FriendlyDateInput label="Počátek smlouvy" value={contractStartDate} onChange={setContractStartDate} />
        <FriendlyDateInput label="Výroční den" value={contractAnniversaryDate} onChange={setContractAnniversaryDate} />
        <FriendlyDateInput
          label="Požadované datum účinnosti"
          value={requestedEffectiveDate}
          onChange={setRequestedEffectiveDate}
        />
        <div>
          <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">
            ID zdrojového dokumentu
          </label>
          <input
            value={sourceDocumentId}
            onChange={(e) => setSourceDocumentId(e.target.value)}
            className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px] font-mono text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Způsob ukončení</label>
          <select
            value={terminationMode}
            onChange={(e) => setTerminationMode(e.target.value as TerminationMode)}
            className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
          >
            {MODE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] p-3 space-y-2 text-sm">
        <legend className="text-xs font-medium px-1">Pojistník v dopise</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="det-ph"
            checked={policyholderKind === "person"}
            onChange={() => setPolicyholderKind("person")}
          />
          Fyzická osoba
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="det-ph"
            checked={policyholderKind === "company"}
            onChange={() => setPolicyholderKind("company")}
          />
          Právnická osoba
        </label>
        {policyholderKind === "company" ? (
          <div className="grid gap-2 pt-1">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Firma"
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm"
            />
            <input
              value={authorizedPersonName}
              onChange={(e) => setAuthorizedPersonName(e.target.value)}
              placeholder="Oprávněná osoba"
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm"
            />
            <input
              value={authorizedPersonRole}
              onChange={(e) => setAuthorizedPersonRole(e.target.value)}
              placeholder="Role"
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </fieldset>

      <div>
        <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Místo v záhlaví</label>
        <input
          value={placeOverride}
          onChange={(e) => setPlaceOverride(e.target.value)}
          className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
        />
      </div>
      {terminationMode === "after_claim" ? (
        <FriendlyDateInput
          label="Datum PU / oznámení (volitelné)"
          value={claimEventDate}
          onChange={setClaimEventDate}
        />
      ) : null}
      <div>
        <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">
          Interní poznámka pro kontrolu
        </label>
        <textarea
          value={advisorNoteForReview}
          onChange={(e) => setAdvisorNoteForReview(e.target.value)}
          rows={2}
          className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => void onSave()}
        className="rounded-[var(--wp-radius)] bg-[var(--wp-accent)] px-4 py-2.5 text-sm font-semibold text-white min-h-[44px] disabled:opacity-50"
      >
        {pending ? "Ukládám…" : "Uložit údaje a znovu vyhodnotit pravidla"}
      </button>
    </section>
  );
}
