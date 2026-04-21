"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import {
  appendTerminationDispatchLogAction,
  getTerminationRequestDetail,
  updateTerminationRequestStatusAction,
  type TerminationRequestDetail,
} from "@/app/actions/terminations";
import { TerminationLetterPreviewPanel } from "../new/TerminationLetterPreviewPanel";
import { TerminationRequestFieldsForm } from "./TerminationRequestFieldsForm";
import type { TerminationDeliveryChannel, TerminationRequestStatus } from "@/lib/db/schema-for-client";
import { terminationDeliveryChannels, terminationRequestStatuses } from "@/lib/db/schema-for-client";
import { terminationDeliveryChannelLabel, terminationDispatchStatusLabel } from "@/lib/terminations/client";
import {
  getTerminationStatusBadgeClassName,
  getTerminationStatusLabel,
} from "@/lib/terminations/status-meta";
import { ButtonLink } from "@/app/components/ui/primitives";
import { formatIsoDateForUiCs } from "@/lib/forms/cz-date";

type Props = {
  requestId: string;
  initial: TerminationRequestDetail;
  segments: string[];
  canWriteFields: boolean;
  previewSurface: "advisor" | "full";
};

const DISPATCH_STATUS = ["pending", "sent", "delivered", "failed", "bounced", "cancelled"] as const;

const WIZARD_CONTINUE_BLOCKED = new Set(["completed", "cancelled", "dispatched"]);

export function TerminationRequestDetailClient({
  requestId,
  initial,
  segments,
  canWriteFields,
  previewSurface,
}: Props) {
  const [detail, setDetail] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const res = await getTerminationRequestDetail(requestId);
      if (res.ok) setDetail(res.data);
      else setError(res.error);
    });
  }, [requestId]);

  const [statusNote, setStatusNote] = useState("");
  const [dispatchChannel, setDispatchChannel] = useState<TerminationDeliveryChannel>("postal_mail");
  const [dispatchOutcome, setDispatchOutcome] = useState<(typeof DISPATCH_STATUS)[number]>("sent");
  const [trackingRef, setTrackingRef] = useState("");
  const [carrier, setCarrier] = useState("");

  const onStatusSave = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await updateTerminationRequestStatusAction({
        requestId,
        status: detail.request.status as TerminationRequestStatus,
        note: statusNote.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatusNote("");
      refresh();
    });
  }, [detail, requestId, refresh, statusNote]);

  const onDispatchSave = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await appendTerminationDispatchLogAction({
        requestId,
        channel: dispatchChannel,
        status: dispatchOutcome,
        trackingReference: trackingRef.trim() || null,
        carrierOrProvider: carrier.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTrackingRef("");
      setCarrier("");
      refresh();
    });
  }, [carrier, dispatchChannel, dispatchOutcome, requestId, refresh, trackingRef]);

  const { request: r, events, dispatchLog } = detail;
  const advisorLike = previewSurface === "advisor";
  const submissionDisplayIso =
    r.requestedSubmissionDate?.trim() ||
    (r.terminationMode === "within_two_months_from_inception"
      ? r.requestedEffectiveDate?.trim()
      : undefined);

  const statusPanel = (
    <details className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)]">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[color:var(--wp-text)]">
        Změna stavu žádosti
      </summary>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Stav</label>
            <select
              value={detail.request.status}
              onChange={(e) => {
                setDetail((d) => ({
                  ...d,
                  request: { ...d.request, status: e.target.value as TerminationRequestStatus },
                }));
              }}
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
            >
              {terminationRequestStatuses.map((s) => (
                <option key={s} value={s}>
                  {getTerminationStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-[2]">
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">
              Poznámka k změně (volitelné)
            </label>
            <input
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
              placeholder="např. schváleno klientem"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onStatusSave()}
            className="rounded-[var(--wp-radius)] bg-[var(--wp-accent)] px-4 py-2.5 text-sm font-semibold text-white min-h-[44px] disabled:opacity-50"
          >
            Uložit stav
          </button>
        </div>
      </div>
    </details>
  );

  const dispatchPanel = (
    <details className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)]">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[color:var(--wp-text)]">
        Záznam odeslání
        {dispatchLog.length > 0 ? ` (${dispatchLog.length})` : ""}
      </summary>
      <div className="px-4 pb-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Kanál</label>
            <select
              value={dispatchChannel}
              onChange={(e) => setDispatchChannel(e.target.value as TerminationDeliveryChannel)}
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
            >
              {terminationDeliveryChannels.map((c) => (
                <option key={c} value={c}>
                  {terminationDeliveryChannelLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Výsledek</label>
            <select
              value={dispatchOutcome}
              onChange={(e) => setDispatchOutcome(e.target.value as (typeof DISPATCH_STATUS)[number])}
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
            >
              {DISPATCH_STATUS.map((s) => (
                <option key={s} value={s}>
                  {terminationDispatchStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">
              Tracking / číslo zásilky
            </label>
            <input
              value={trackingRef}
              onChange={(e) => setTrackingRef(e.target.value)}
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Dopravce</label>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void onDispatchSave()}
          className="rounded-[var(--wp-radius)] bg-[var(--wp-accent)] px-4 py-2.5 text-sm font-semibold text-white min-h-[44px] disabled:opacity-50"
        >
          Zapsat pokus o odeslání
        </button>
        {dispatchLog.length > 0 ? (
          <ul className="text-xs space-y-2 border-t border-[color:var(--wp-border)] pt-3">
            {dispatchLog.map((d) => (
              <li key={d.id} className="rounded-[var(--wp-radius)] bg-[color:var(--wp-surface-muted)]/50 px-3 py-2">
                <span className="font-semibold">
                  {new Date(d.createdAt ?? "").toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
                </span>{" "}
                · {terminationDeliveryChannelLabel(d.channel)} · {terminationDispatchStatusLabel(d.status)}
                {d.trackingReference ? ` · ${d.trackingReference}` : ""}
                {d.error ? ` · chyba: ${d.error}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[color:var(--wp-text-secondary)]">Zatím žádný záznam odeslání.</p>
        )}
      </div>
    </details>
  );

  const historyPanel =
    events.length > 0 ? (
      <details className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)]">
        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-[color:var(--wp-text-muted)]">
          Historie změn ({events.length})
        </summary>
        <ul className="text-xs space-y-1 px-4 pb-4 max-h-48 overflow-y-auto">
          {events.map((e) => {
            const date = new Date(e.createdAt).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
            const label: Record<string, string> = {
              created: "Žádost vytvořena",
              status_changed: "Změna stavu",
              rules_result: "Vyhodnocení pravidel",
              note: "Poznámka",
              document_linked: "Dokument přiřazen",
              dispatch_attempt: "Pokus o odeslání",
              reminder: "Připomenutí",
              review_assignment: "Přiřazení ke kontrole",
            };
            return (
              <li key={e.id} className="py-1.5 border-b border-[color:var(--wp-border)] last:border-0 flex gap-2">
                <span className="text-[color:var(--wp-text-muted)] shrink-0">{date}</span>
                <span>{label[e.eventType] ?? e.eventType}</span>
              </li>
            );
          })}
        </ul>
      </details>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--wp-text)]">Žádost o výpověď</h1>
          <p className="text-sm text-[color:var(--wp-text-secondary)] font-mono">{requestId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!WIZARD_CONTINUE_BLOCKED.has(r.status) ? (
            <ButtonLink
              href={`/portal/terminations/new?draftId=${requestId}`}
              variant="primary"
              size="lg"
            >
              Pokračovat v úpravách
            </ButtonLink>
          ) : null}
          {r.contactId ? (
            <ButtonLink href={`/portal/contacts/${r.contactId}`} variant="secondary" size="lg">
              Kontakt
            </ButtonLink>
          ) : null}
          <ButtonLink href="/portal/terminations/new" variant="secondary" size="lg">
            Nová žádost
          </ButtonLink>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-4 space-y-3">
        <h2 className="text-sm font-bold text-[color:var(--wp-text)]">Souhrn</h2>
        <dl className="grid gap-2 text-sm text-[color:var(--wp-text-secondary)] sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-[color:var(--wp-text)]">Pojišťovna</dt>
            <dd>{r.insurerName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--wp-text)]">Smlouva</dt>
            <dd>{r.contractNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--wp-text)]">Stav</dt>
            <dd>
              <span className={getTerminationStatusBadgeClassName(r.status)}>
                {getTerminationStatusLabel(r.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--wp-text)]">Kanál doručení</dt>
            <dd>{terminationDeliveryChannelLabel(r.deliveryChannel)}</dd>
          </div>
          {submissionDisplayIso ? (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-[color:var(--wp-text)]">Datum podání</dt>
              <dd>
                {formatIsoDateForUiCs(submissionDisplayIso)}
                {!r.requestedSubmissionDate?.trim() && r.requestedEffectiveDate?.trim()
                  ? " (dříve uloženo v účinnosti – migrace)"
                  : null}
              </dd>
            </div>
          ) : null}
          {r.computedEffectiveDate ||
          (r.terminationMode !== "within_two_months_from_inception" && r.requestedEffectiveDate) ? (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-[color:var(--wp-text)]">Datum účinnosti</dt>
              <dd>
                {formatIsoDateForUiCs(
                  r.computedEffectiveDate ??
                    (r.terminationMode !== "within_two_months_from_inception"
                      ? r.requestedEffectiveDate
                      : null) ??
                    null,
                )}
                {r.computedEffectiveDate
                  ? " (dopočítáno pravidly)"
                  : " (požadované)"}
              </dd>
            </div>
          ) : null}
        </dl>
        {r.reviewRequiredReason ? (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-[var(--wp-radius)] px-3 py-2">
            Žádost vyžaduje kontrolu před odesláním.
          </p>
        ) : null}
        {r.status === "awaiting_data" ? (
          <p className="text-sm text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-[var(--wp-radius)] px-3 py-2">
            Doplňte chybějící údaje a pokračujte v úpravách pomocí tlačítka výše.
          </p>
        ) : null}
      </section>

      {canWriteFields ? (
        <TerminationRequestFieldsForm
          requestId={requestId}
          detail={detail}
          segments={segments}
          onApplied={refresh}
        />
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[color:var(--wp-text)]">Náhled dokumentu</h2>
        <TerminationLetterPreviewPanel requestId={requestId} surface={previewSurface} />
      </section>

      {advisorLike ? (
        <details className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[color:var(--wp-text)]">
            Provozní a interní nástroje
          </summary>
          <div className="space-y-4 border-t border-[color:var(--wp-border)] px-2 py-4">
            {statusPanel}
            {dispatchPanel}
            {historyPanel}
          </div>
        </details>
      ) : (
        <>
          {statusPanel}
          {dispatchPanel}
          {historyPanel}
        </>
      )}
    </div>
  );
}
