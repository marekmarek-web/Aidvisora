"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchContactDocumentsBundle } from "@/app/dashboard/contacts/contact-documents-bundle";
import {
  getContractSegments,
  updateContract,
  deleteContract,
  approveContractForClientPortal,
  getContractAiProvenance,
} from "@/app/actions/contracts";
import type { ContractRow, ContractAiProvenanceResult } from "@/app/actions/contracts";
import {
  getPotentialDuplicateContractPairs,
  mergeDuplicateContracts,
} from "@/app/actions/contract-dedup";
import { ProductPicker } from "@/app/components/aidvisora/ProductPicker";
import type { ProductPickerValue } from "@/app/components/aidvisora/ProductPicker";
import { segmentLabel } from "@/app/lib/segment-labels";
import { EUCS_ZP_DISCLAIMER } from "@/data/insurance-ratings";
import { ConfirmDeleteModal } from "@/app/components/ConfirmDeleteModal";
import { NewContractWizard } from "@/app/components/aidvisora/NewContractWizard";
import { DocumentUploadZone } from "@/app/components/upload/DocumentUploadZone";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import { ContractParametersFields } from "@/app/components/aidvisora/ContractParametersFields";
import { FileText, ScrollText } from "lucide-react";
import Link from "next/link";
import {
  initialContractFormState,
  resetContractFormForNewSegment,
  validateContractFormForSubmit,
} from "@/lib/contracts/contract-form-payload";
import type { ContractFormState } from "@/lib/contracts/contract-form-payload";
import { segmentUsesAnnualPremiumPrimaryInput } from "@/lib/contracts/contract-segment-wizard-config";
import { annualPremiumFromMonthlyInput } from "@/lib/contracts/annual-premium-from-monthly";
import { mapContractToCanonicalProduct } from "@/lib/client-portfolio/canonical-contract-read";
import { CanonicalProductAdvisorOverviewCard } from "./CanonicalProductAdvisorOverviewCard";

export function ContractsSection({ contactId }: { contactId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const bundleQK = queryKeys.contacts.documentsBundle(contactId);

  const {
    data: bundleData,
    isPending: loading,
    isError: bundleIsError,
    error: bundleErr,
    refetch: refetchBundle,
  } = useQuery({
    queryKey: bundleQK,
    queryFn: () => fetchContactDocumentsBundle(contactId),
    staleTime: 45_000,
  });

  const { data: segments = [] } = useQuery({
    queryKey: queryKeys.contacts.contractSegments(),
    queryFn: getContractSegments,
    staleTime: 300_000,
  });

  const { data: dupPairs = [] } = useQuery({
    queryKey: queryKeys.contacts.contractDupPairs(contactId),
    queryFn: () => getPotentialDuplicateContractPairs(contactId),
    staleTime: 45_000,
  });

  const list = bundleData?.contracts ?? [];
  const pendingList = list.filter((c) => c.portfolioStatus === "pending_review");
  const mainList = list.filter((c) => c.portfolioStatus !== "pending_review");
  const loadError = bundleIsError
    ? bundleErr instanceof Error
      ? bundleErr.message
      : "Nepodařilo se načíst smlouvy."
    : null;

  const invalidateContractsData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: bundleQK });
    void queryClient.invalidateQueries({ queryKey: queryKeys.contacts.contractDupPairs(contactId) });
  }, [queryClient, bundleQK, contactId]);
  const [provenanceMap, setProvenanceMap] = useState<Record<string, ContractAiProvenanceResult>>({});

  // Načítáme provenance lazy pro AI Review smlouvy (jen jednou per contract)
  useEffect(() => {
    const aiContracts = list.filter(
      (c) => c.sourceKind === "ai_review" && c.sourceContractReviewId,
    );
    for (const c of aiContracts) {
      if (provenanceMap[c.id] !== undefined) continue;
      void getContractAiProvenance(c.id).then((prov) => {
        setProvenanceMap((prev) => ({ ...prev, [c.id]: prov }));
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const [editingId, setEditingId] = useState<string | null>(null);
  /** URL `add=1` je pravda; zavírání přes App Router je však asynchronní — bez tohoto zůstane modal otevřený, dokud nedorazí nová URL. */
  const urlWantsContractWizard = searchParams.get("add") === "1";
  const [wizardDismissedOptimistic, setWizardDismissedOptimistic] = useState(false);
  useEffect(() => {
    if (urlWantsContractWizard) setWizardDismissedOptimistic(false);
  }, [urlWantsContractWizard]);
  const wizardOpen = urlWantsContractWizard && !wizardDismissedOptimistic;
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<ContractFormState>(() => initialContractFormState());
  const [pickerValue, setPickerValue] = useState<ProductPickerValue>({ partnerId: "", productId: "" });
  const [visibleToClientEdit, setVisibleToClientEdit] = useState(true);
  const [portfolioStatusEdit, setPortfolioStatusEdit] = useState("active");
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [mergeBusyKey, setMergeBusyKey] = useState<string | null>(null);

  const clearAddQueryParam = useCallback(() => {
    if (searchParams.get("add") !== "1") return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("add");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openAddWizardInUrl = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("add", "1");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);


  async function handleSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSubmitError(null);
    const validation = validateContractFormForSubmit(form);
    if (!validation.ok) {
      setSubmitError(validation.message);
      return;
    }
    const payload = {
      segment: form.segment,
      partnerId: form.partnerId || undefined,
      productId: form.productId || undefined,
      partnerName: form.partnerName || undefined,
      productName: form.productName || undefined,
      premiumAmount: form.premiumAmount || undefined,
      premiumAnnual: form.premiumAnnual || undefined,
      contractNumber: form.contractNumber || undefined,
      startDate: form.startDate || undefined,
      anniversaryDate: form.anniversaryDate || undefined,
      note: form.note || undefined,
      visibleToClient: visibleToClientEdit,
      portfolioStatus: portfolioStatusEdit,
    };
    try {
      await updateContract(editingId, payload);
      setForm(initialContractFormState());
      setPickerValue({ partnerId: "", productId: "" });
      setEditingId(null);
      invalidateContractsData();
    } catch (err) {
      console.error("Chyba při ukládání smlouvy:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Smlouvu se nepodařilo uložit. Zkontrolujte vyplněné údaje a zkuste to znovu.";
      setSubmitError(message);
    }
  }

  async function handleApproveForClient(contractId: string) {
    setPublishBusyId(contractId);
    try {
      await approveContractForClientPortal(contractId);
      invalidateContractsData();
    } catch (err) {
      console.error(err);
    } finally {
      setPublishBusyId(null);
    }
  }

  async function handleMergePair(keepId: string, removeId: string, pairKey: string) {
    setMergeBusyKey(pairKey);
    try {
      await mergeDuplicateContracts(keepId, removeId);
      invalidateContractsData();
    } catch (err) {
      console.error(err);
    } finally {
      setMergeBusyKey(null);
    }
  }

  async function doDelete(id: string) {
    setDeletePending(true);
    try {
      await deleteContract(id);
      invalidateContractsData();
      if (editingId === id) setEditingId(null);
      setDeleteConfirmId(null);
    } finally {
      setDeletePending(false);
    }
  }

  function startEdit(c: ContractRow) {
    setEditingId(c.id);
    setVisibleToClientEdit(c.visibleToClient !== false);
    setPortfolioStatusEdit(c.portfolioStatus ?? "active");
    const premiumAmount = c.premiumAmount ?? "";
    let premiumAnnual = c.premiumAnnual ?? "";
    if (segmentUsesAnnualPremiumPrimaryInput(c.segment) && !premiumAnnual.trim() && premiumAmount.trim()) {
      premiumAnnual = annualPremiumFromMonthlyInput(premiumAmount);
    }
    setForm({
      segment: c.segment,
      partnerId: c.partnerId ?? "",
      productId: c.productId ?? "",
      partnerName: c.partnerName ?? "",
      productName: c.productName ?? "",
      premiumAmount,
      premiumAnnual,
      contractNumber: c.contractNumber ?? "",
      startDate: c.startDate ?? "",
      anniversaryDate: c.anniversaryDate ?? "",
      note: c.note ?? "",
    });
    setPickerValue({
      partnerId: c.partnerId ?? "",
      productId: c.productId ?? "",
      partnerName: c.partnerName ?? undefined,
      productName: c.productName ?? undefined,
    });
  }

  if (loading) return <p className="text-[color:var(--wp-text-muted)] text-sm">Načítám smlouvy…</p>;

  if (loadError) {
    return (
      <div className="rounded-[var(--wp-radius-lg)] border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-red-600 text-sm mb-3">{loadError}</p>
        <button type="button" onClick={() => void refetchBundle()} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 min-h-[44px]">
          Zkusit znovu
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-6 shadow-sm">
      <ConfirmDeleteModal
        open={deleteConfirmId !== null}
        title="Opravdu smazat smlouvu?"
        onConfirm={() => deleteConfirmId && doDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
        loading={deletePending}
      />
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-[color:var(--wp-text)]">Produkty / Smlouvy</h2>
        <Link
          href={`/portal/terminations/new?contactId=${encodeURIComponent(contactId)}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-xs font-semibold text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)] min-h-[44px] shrink-0"
        >
          <ScrollText className="size-4 shrink-0" aria-hidden />
          Výpověď bez smlouvy
        </Link>
      </div>
      <p className="text-xs text-[color:var(--wp-text-muted)] mb-4">
        {EUCS_ZP_DISCLAIMER}
      </p>
      {dupPairs.length > 0 ? (
        <div className="mb-4 rounded-[var(--wp-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold mb-2">Možné duplicity (zkontrolujte ručně)</p>
          <ul className="space-y-3">
            {dupPairs.map((p, idx) => {
              const pairKey = `dup-${idx}`;
              return (
                <li key={pairKey} className="rounded-[var(--wp-radius)] border border-amber-200/80 bg-white/80 px-3 py-2">
                  <p className="text-sm">
                    {p.reason === "same_contract_number" ? "Stejné číslo smlouvy" : "Stejný partner, produkt a segment"}:{" "}
                    <span className="font-mono text-xs">{p.contractA.contractNumber || p.contractA.id.slice(0, 8)}</span> vs{" "}
                    <span className="font-mono text-xs">{p.contractB.contractNumber || p.contractB.id.slice(0, 8)}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={mergeBusyKey !== null}
                      onClick={() => void handleMergePair(p.contractA.id, p.contractB.id, `${pairKey}-a`)}
                      className="rounded-[var(--wp-radius)] border border-amber-300 bg-amber-100/80 px-3 py-2 text-xs font-semibold text-amber-950 min-h-[44px] hover:bg-amber-100 disabled:opacity-50"
                    >
                      {mergeBusyKey === `${pairKey}-a` ? "Slučuji…" : "Sloučit: ponechat první"}
                    </button>
                    <button
                      type="button"
                      disabled={mergeBusyKey !== null}
                      onClick={() => void handleMergePair(p.contractB.id, p.contractA.id, `${pairKey}-b`)}
                      className="rounded-[var(--wp-radius)] border border-amber-300 bg-amber-100/80 px-3 py-2 text-xs font-semibold text-amber-950 min-h-[44px] hover:bg-amber-100 disabled:opacity-50"
                    >
                      {mergeBusyKey === `${pairKey}-b` ? "Slučuji…" : "Sloučit: ponechat druhou"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <section className="mb-6 space-y-3" aria-label="Poradenský přehled produktů">
        <div>
          <p className="text-xs font-semibold text-[color:var(--wp-text-muted)] uppercase tracking-wide">Přehled držby</p>
          <p className="text-xs text-[color:var(--wp-text-muted)] mt-1 max-w-3xl leading-relaxed">
            Stejná kanonická evidence jako v klientském portfoliu — údaje zapisujeme jen tam, kde je máme; chybějící pole zůstávají prázdná.
          </p>
        </div>
        {mainList.length === 0 ? (
          <div className="rounded-[var(--wp-radius-lg)] border border-dashed border-[color:var(--wp-border)] bg-[color:var(--wp-surface-muted)]/40 px-4 py-8 text-center">
            <p className="text-sm font-medium text-[color:var(--wp-text)]">Zatím žádná smlouva v tomto přehledu</p>
            <p className="text-xs text-[color:var(--wp-text-muted)] mt-2 max-w-md mx-auto">
              Po přidání smlouvy nebo po schválení pro klienta se zde zobrazí karty podle segmentu — včetně detailů z evidence (rizika u životního pojištění, fondy u investic, limity u majetku a vozidel atd.).
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-1 xl:grid-cols-2">
            {mainList.map((c) => (
              <CanonicalProductAdvisorOverviewCard
                key={c.id}
                contactId={contactId}
                contract={c}
                product={mapContractToCanonicalProduct(c)}
                provenance={provenanceMap[c.id]}
                variant="published"
                onEdit={() => startEdit(c)}
                onDelete={() => setDeleteConfirmId(c.id)}
              />
            ))}
          </div>
        )}
      </section>
      {pendingList.length > 0 ? (
        <div className="mb-4 rounded-[var(--wp-radius)] border border-indigo-200 bg-indigo-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-indigo-950 mb-2">Čeká na publikaci do klientské zóny</p>
          <div className="grid gap-3 md:grid-cols-1 xl:grid-cols-2">
            {pendingList.map((c) => (
              <CanonicalProductAdvisorOverviewCard
                key={c.id}
                contactId={contactId}
                contract={c}
                product={mapContractToCanonicalProduct(c)}
                provenance={provenanceMap[c.id]}
                variant="pending"
                onEdit={() => startEdit(c)}
                onDelete={() => setDeleteConfirmId(c.id)}
                onApproveForClient={() => void handleApproveForClient(c.id)}
                publishBusy={publishBusyId === c.id}
              />
            ))}
          </div>
        </div>
      ) : null}
      <NewContractWizard
        open={wizardOpen}
        contactId={contactId}
        onClose={() => {
          setWizardDismissedOptimistic(true);
          clearAddQueryParam();
        }}
        onSuccess={() => invalidateContractsData()}
      />
      {editingId ? (
        <form onSubmit={handleSubmitEdit} className="space-y-2 max-w-md">
          <div>
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)]">Segment</label>
            <CustomDropdown
              value={form.segment}
              onChange={(seg) => {
                setForm((f) => resetContractFormForNewSegment(f, seg));
                setPickerValue({ partnerId: "", productId: "" });
              }}
              options={segments.map((s) => ({ id: s, label: segmentLabel(s) }))}
              placeholder="Segment"
              icon={FileText}
            />
          </div>
          <div>
            <ProductPicker
              segment={form.segment}
              value={pickerValue}
              onChange={(v) => {
                setPickerValue(v);
                setForm((f) => ({
                  ...f,
                  partnerId: v.partnerId,
                  productId: v.productId,
                  partnerName: v.partnerName ?? f.partnerName,
                  productName: v.productName ?? f.productName,
                }));
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)]">Partner / Produkt (text)</label>
            <input
              value={form.partnerName}
              onChange={(e) => setForm((f) => ({ ...f, partnerName: e.target.value }))}
              placeholder="název partnera"
              className="w-full rounded border border-monday-border px-2 py-1.5 text-sm"
            />
            <input
              value={form.productName}
              onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
              placeholder="název produktu"
              className="w-full rounded border border-monday-border px-2 py-1.5 text-sm mt-1"
            />
          </div>
          <ContractParametersFields
            form={form}
            setForm={setForm}
            classes={{
              label: "block text-xs font-medium text-[color:var(--wp-text-muted)]",
              input: "w-full rounded border border-monday-border px-2 py-1.5 text-sm min-h-[44px]",
            }}
          />
          <div className="flex flex-col gap-2 rounded border border-[color:var(--wp-border)] p-3 bg-[color:var(--wp-surface-muted)]">
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={visibleToClientEdit}
                onChange={(e) => setVisibleToClientEdit(e.target.checked)}
                className="h-5 w-5 rounded border-monday-border"
              />
              <span className="text-sm text-[color:var(--wp-text)]">Zobrazit v klientské zóně (Moje portfolio)</span>
            </label>
            <div>
              <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Stav v portfoliu</label>
              <select
                value={portfolioStatusEdit}
                onChange={(e) => setPortfolioStatusEdit(e.target.value)}
                className="w-full rounded border border-monday-border px-2 py-2 text-sm min-h-[44px]"
              >
                <option value="active">Aktivní</option>
                <option value="ended">Ukončené</option>
                <option value="pending_review">Čeká na kontrolu</option>
                <option value="draft">Koncept</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[color:var(--wp-text-muted)] mb-1">Nahrát smlouvu (PDF)</label>
            <DocumentUploadZone
              key={`${contactId}-${form.segment}-${editingId}`}
              contactId={contactId}
              initialContractId={editingId}
              submitButtonLabel="Nahrát smlouvu"
              chooseButtonLabel="Vybrat smlouvu (PDF / foto)"
              onUploaded={() => invalidateContractsData()}
              className="p-0 border-0 bg-transparent"
            />
          </div>
          {submitError && <p className="text-sm text-red-600" role="alert">{submitError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded px-3 py-1.5 text-sm font-semibold text-white bg-monday-blue"
            >
              Uložit
            </button>
            <button
              type="button"
              onClick={() => { setEditingId(null); setSubmitError(null); }}
              className="rounded px-3 py-1.5 text-sm font-semibold border border-[color:var(--wp-border-strong)] text-[color:var(--wp-text-muted)]"
            >
              Zrušit
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => openAddWizardInUrl()}
          className="rounded-[var(--wp-radius)] px-4 py-2.5 text-sm font-semibold bg-[var(--wp-accent)] text-white hover:opacity-90 min-h-[44px]"
        >
          + Přidat produkt / smlouvu
        </button>
      )}
    </div>
  );
}
