"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdvisorProposalRow } from "@/app/actions/advisor-proposals";
import {
  createAdvisorProposal,
  deleteAdvisorProposal,
  publishAdvisorProposal,
  withdrawAdvisorProposal,
  listProposalsForContact,
} from "@/app/actions/advisor-proposals";
import type { AdvisorProposalSegment } from "db";
import {
  ADVISOR_PROPOSAL_SEGMENT_LABELS,
  ADVISOR_PROPOSAL_SEGMENT_OPTIONS,
  ADVISOR_PROPOSAL_STATUS_LABELS,
  formatDateCs,
  formatMoneyCs,
} from "@/lib/advisor-proposals/segment-labels";

type Benefit = { label: string; delta?: string | null };

type DraftFormState = {
  segment: AdvisorProposalSegment;
  title: string;
  summary: string;
  currentAnnualCost: string;
  proposedAnnualCost: string;
  validUntil: string;
  benefits: Benefit[];
  publishImmediately: boolean;
};

const EMPTY_FORM: DraftFormState = {
  segment: "insurance_auto",
  title: "",
  summary: "",
  currentAnnualCost: "",
  proposedAnnualCost: "",
  validUntil: "",
  benefits: [],
  publishImmediately: true,
};

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "published":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "viewed":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "accepted":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "declined":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "expired":
    case "withdrawn":
      return "bg-slate-100 text-slate-500 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function ContactAdvisorProposalsClient({
  contactId,
  initialProposals,
}: {
  contactId: string;
  initialProposals: AdvisorProposalRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [proposals, setProposals] = useState<AdvisorProposalRow[]>(initialProposals);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DraftFormState>(EMPTY_FORM);
  const [sourceRunId, setSourceRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const autoOpenHandled = useRef(false);

  useEffect(() => {
    if (autoOpenHandled.current) return;
    const runId = searchParams.get("openProposalFromRun");
    const calcType = searchParams.get("calcType");
    const title = searchParams.get("proposalTitle");
    if (!runId && !searchParams.get("openProposal")) return;
    autoOpenHandled.current = true;

    const segmentMap: Record<string, AdvisorProposalSegment> = {
      mortgage: "mortgage",
      loan: "credit",
      investment: "investment",
      pension: "pension",
      life: "insurance_life",
    };
    const prefSegment: AdvisorProposalSegment =
      (calcType && segmentMap[calcType]) || EMPTY_FORM.segment;

    setForm({
      ...EMPTY_FORM,
      segment: prefSegment,
      title: title ?? "",
    });
    if (runId) setSourceRunId(runId);
    setModalOpen(true);
  }, [searchParams]);

  function resetAndClose() {
    setForm(EMPTY_FORM);
    setError(null);
    setSourceRunId(null);
    setModalOpen(false);
  }

  function refresh() {
    startTransition(async () => {
      const rows = await listProposalsForContact(contactId).catch(() => [] as AdvisorProposalRow[]);
      setProposals(rows);
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const title = form.title.trim();
    if (!title) {
      setError("Vyplňte název návrhu.");
      return;
    }
    startTransition(async () => {
      const res = await createAdvisorProposal({
        contactId,
        segment: form.segment,
        title,
        summary: form.summary.trim() || null,
        currentAnnualCost: parseNumber(form.currentAnnualCost),
        proposedAnnualCost: parseNumber(form.proposedAnnualCost),
        validUntil: form.validUntil || null,
        benefits: form.benefits.filter((b) => b.label.trim()).map((b) => ({
          label: b.label.trim(),
          delta: b.delta?.trim() || null,
        })),
        sourceCalculatorRunId: sourceRunId,
        publishImmediately: form.publishImmediately,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      resetAndClose();
      refresh();
    });
  }

  function handlePublish(id: string) {
    startTransition(async () => {
      const res = await publishAdvisorProposal(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      refresh();
    });
  }

  function handleWithdraw(id: string) {
    if (!confirm("Opravdu stáhnout tento návrh z klientské zóny?")) return;
    startTransition(async () => {
      const res = await withdrawAdvisorProposal(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Opravdu smazat tento koncept?")) return;
    startTransition(async () => {
      const res = await deleteAdvisorProposal(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      refresh();
    });
  }

  function updateBenefit(idx: number, patch: Partial<Benefit>) {
    setForm((f) => ({
      ...f,
      benefits: f.benefits.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  }

  function addBenefit() {
    setForm((f) => ({ ...f, benefits: [...f.benefits, { label: "", delta: "" }] }));
  }

  function removeBenefit(idx: number) {
    setForm((f) => ({ ...f, benefits: f.benefits.filter((_, i) => i !== idx) }));
  }

  const activeCount = proposals.filter((p) => p.status === "published" || p.status === "viewed").length;
  const totalSavings = proposals
    .filter((p) => (p.status === "published" || p.status === "viewed") && (p.savingsAnnual ?? 0) > 0)
    .reduce((sum, p) => sum + (p.savingsAnnual ?? 0), 0);

  return (
    <div
      id="advisor-proposals"
      className="rounded-xl border border-[var(--brand-border)] bg-[color:var(--wp-surface)] shadow-sm overflow-hidden scroll-mt-20"
    >
      <div className="px-4 md:px-6 py-4 border-b border-[var(--brand-border)] flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[color:var(--wp-text)]">Návrhy pro klienta v portálu</h2>
          <p className="text-xs text-[color:var(--wp-text-muted)] mt-0.5 max-w-xl">
            Nezávazná porovnání (úspora / lepší podmínky), která poradce publikuje do Klientské zóny. Není
            to automatické doporučení — rozhoduje klient po konzultaci s vámi.
          </p>
          {(activeCount > 0 || totalSavings > 0) && (
            <p className="text-xs font-semibold text-emerald-700 mt-2">
              {activeCount > 0 ? `Aktivní: ${activeCount}` : ""}
              {activeCount > 0 && totalSavings > 0 ? " · " : ""}
              {totalSavings > 0 ? `Zobrazená úspora: ${formatMoneyCs(totalSavings, "CZK")} / rok` : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white min-h-[44px]"
          style={{ backgroundColor: "var(--brand-main)" }}
        >
          + Nový návrh
        </button>
      </div>

      <div className="divide-y divide-[var(--brand-border)]">
        {proposals.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--wp-text-muted)]">
            Zatím jste klientovi nepublikovali žádný návrh. Vytvořte úsporu nebo lepší podmínku z modelace
            — klient ji uvidí ve své Klientské zóně a bude se mu připomínat při každé návštěvě.
          </div>
        ) : (
          proposals.map((p) => (
            <ProposalRow
              key={p.id}
              proposal={p}
              pending={pending}
              onPublish={handlePublish}
              onWithdraw={handleWithdraw}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {error && (
        <div className="px-6 py-3 text-sm text-rose-700 bg-rose-50 border-t border-rose-100">{error}</div>
      )}

      {modalOpen && (
        <ProposalModal
          form={form}
          setForm={setForm}
          error={error}
          pending={pending}
          onClose={resetAndClose}
          onSubmit={handleSubmit}
          onAddBenefit={addBenefit}
          onRemoveBenefit={removeBenefit}
          onUpdateBenefit={updateBenefit}
        />
      )}
    </div>
  );
}

function ProposalRow({
  proposal,
  pending,
  onPublish,
  onWithdraw,
  onDelete,
}: {
  proposal: AdvisorProposalRow;
  pending: boolean;
  onPublish: (id: string) => void;
  onWithdraw: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const statusLabel = ADVISOR_PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status;
  const segmentLabel = ADVISOR_PROPOSAL_SEGMENT_LABELS[proposal.segment] ?? proposal.segment;
  return (
    <div className="p-4 md:p-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${statusBadgeClass(
                proposal.status,
              )}`}
            >
              {statusLabel}
            </span>
            <span className="text-xs text-[color:var(--wp-text-muted)]">{segmentLabel}</span>
          </div>
          <h3 className="text-base font-semibold text-[color:var(--wp-text)]">{proposal.title}</h3>
          {proposal.summary && (
            <p className="text-sm text-[color:var(--wp-text-muted)] mt-1 line-clamp-3">{proposal.summary}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {proposal.savingsAnnual !== null && proposal.savingsAnnual > 0 ? (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Úspora / rok</div>
              <div className="text-xl font-black text-emerald-700">
                {formatMoneyCs(proposal.savingsAnnual, proposal.currency)}
              </div>
            </>
          ) : (
            <div className="text-xs text-[color:var(--wp-text-muted)]">bez vyčíslení úspory</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[color:var(--wp-text-muted)]">
            Aktuální náklad
          </span>
          <span className="font-semibold text-[color:var(--wp-text)]">
            {formatMoneyCs(proposal.currentAnnualCost, proposal.currency)}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[color:var(--wp-text-muted)]">
            Nová cena
          </span>
          <span className="font-semibold text-[color:var(--wp-text)]">
            {formatMoneyCs(proposal.proposedAnnualCost, proposal.currency)}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[color:var(--wp-text-muted)]">
            Platnost do
          </span>
          <span className="font-semibold text-[color:var(--wp-text)]">
            {formatDateCs(proposal.validUntil) ?? "—"}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[color:var(--wp-text-muted)]">
            Publikováno
          </span>
          <span className="font-semibold text-[color:var(--wp-text)]">
            {proposal.publishedAt ? new Date(proposal.publishedAt).toLocaleDateString("cs-CZ") : "—"}
          </span>
        </div>
      </div>

      {proposal.benefits && proposal.benefits.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {proposal.benefits.map((b, i) => (
            <li
              key={`${b.label}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-emerald-50 text-emerald-800 border border-emerald-100"
            >
              <span className="font-semibold">{b.label}</span>
              {b.delta && <span className="opacity-80">({b.delta})</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {proposal.status === "draft" && (
          <>
            <button
              type="button"
              onClick={() => onPublish(proposal.id)}
              disabled={pending}
              className="rounded-xl px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 min-h-[40px]"
            >
              Publikovat klientovi
            </button>
            <button
              type="button"
              onClick={() => onDelete(proposal.id)}
              disabled={pending}
              className="rounded-xl px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 min-h-[40px]"
            >
              Smazat
            </button>
          </>
        )}
        {(proposal.status === "published" || proposal.status === "viewed" || proposal.status === "expired") && (
          <button
            type="button"
            onClick={() => onWithdraw(proposal.id)}
            disabled={pending}
            className="rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 min-h-[40px]"
          >
            Stáhnout z portálu
          </button>
        )}
        {proposal.status === "accepted" && proposal.responseRequestId && (
          <a
            href={`/portal/pipeline/${proposal.responseRequestId}`}
            className="rounded-xl px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 min-h-[40px] inline-flex items-center"
          >
            Otevřít požadavek klienta
          </a>
        )}
      </div>
    </div>
  );
}

function ProposalModal({
  form,
  setForm,
  error,
  pending,
  onClose,
  onSubmit,
  onAddBenefit,
  onRemoveBenefit,
  onUpdateBenefit,
}: {
  form: DraftFormState;
  setForm: React.Dispatch<React.SetStateAction<DraftFormState>>;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onAddBenefit: () => void;
  onRemoveBenefit: (idx: number) => void;
  onUpdateBenefit: (idx: number, patch: Partial<Benefit>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Nový návrh pro klienta</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-md text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Segment
            </label>
            <select
              value={form.segment}
              onChange={(e) =>
                setForm((f) => ({ ...f, segment: e.target.value as AdvisorProposalSegment }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px]"
            >
              {ADVISOR_PROPOSAL_SEGMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Název návrhu *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Např. Sjednocení pojištění 5 vozidel (Allianz)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Shrnutí pro klienta
            </label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="Stručné shrnutí, co jste spočítali a proč to dává smysl. Nepoužívejte slovo „doporučujeme“ — jde o nezávazné porovnání."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[120px]"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Aktuální roční náklad (Kč)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.currentAnnualCost}
                onChange={(e) => setForm((f) => ({ ...f, currentAnnualCost: e.target.value }))}
                placeholder="např. 55000"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Navržený roční náklad (Kč)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.proposedAnnualCost}
                onChange={(e) => setForm((f) => ({ ...f, proposedAnnualCost: e.target.value }))}
                placeholder="např. 30000"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Platnost nabídky do (volitelné)
            </label>
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Zlepšení podmínek (volitelné)
              </label>
              <button
                type="button"
                onClick={onAddBenefit}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 min-h-[40px] px-2"
              >
                + Přidat
              </button>
            </div>
            {form.benefits.length === 0 ? (
              <p className="text-xs text-slate-500">
                Např. vyšší limit odpovědnosti, kratší karenční doba, méně výluk…
              </p>
            ) : (
              <ul className="space-y-2">
                {form.benefits.map((b, i) => (
                  <li key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={b.label}
                      onChange={(e) => onUpdateBenefit(i, { label: e.target.value })}
                      placeholder="Název zlepšení"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px]"
                    />
                    <input
                      type="text"
                      value={b.delta ?? ""}
                      onChange={(e) => onUpdateBenefit(i, { delta: e.target.value })}
                      placeholder="Rozdíl / hodnota"
                      className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveBenefit(i)}
                      className="min-h-[44px] min-w-[44px] rounded-md text-rose-600 hover:bg-rose-50"
                      aria-label="Smazat"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              id="publish-immediately"
              type="checkbox"
              checked={form.publishImmediately}
              onChange={(e) => setForm((f) => ({ ...f, publishImmediately: e.target.checked }))}
              className="h-5 w-5"
            />
            <label htmlFor="publish-immediately" className="text-sm text-slate-700">
              Publikovat klientovi ihned (jinak zůstane jako koncept)
            </label>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
            <strong>Poznámka:</strong> Klient uvidí toto porovnání jako „Návrh od vašeho poradce“ — nezávazný
            interní podklad, nikoli automatické doporučení platformy.
          </div>

          {error && <div className="text-sm text-rose-700">{error}</div>}
        </form>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 min-h-[44px]"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={(e) => onSubmit(e as unknown as React.FormEvent)}
            disabled={pending}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]"
          >
            {pending ? "Ukládám…" : form.publishImmediately ? "Uložit a publikovat" : "Uložit jako koncept"}
          </button>
        </div>
      </div>
    </div>
  );
}
