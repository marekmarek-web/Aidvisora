"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchContactDocumentsBundle } from "@/app/dashboard/contacts/contact-documents-bundle";
import { getContractSegments, updateContract } from "@/app/actions/contracts";
import type { ContractRow } from "@/app/actions/contracts";
import { ProductPicker } from "@/app/components/aidvisora/ProductPicker";
import type { ProductPickerValue } from "@/app/components/aidvisora/ProductPicker";
import { segmentLabel } from "@/app/lib/segment-labels";
import { NewContractWizard } from "@/app/components/aidvisora/NewContractWizard";
import { DocumentUploadZone } from "@/app/components/upload/DocumentUploadZone";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import { ContractParametersFields } from "@/app/components/aidvisora/ContractParametersFields";
import { FileText } from "lucide-react";
import {
  initialContractFormState,
  resetContractFormForNewSegment,
  validateContractFormForSubmit,
} from "@/lib/contracts/contract-form-payload";
import type { ContractFormState } from "@/lib/contracts/contract-form-payload";
import { segmentUsesAnnualPremiumPrimaryInput } from "@/lib/contracts/contract-segment-wizard-config";
import { annualPremiumFromMonthlyInput } from "@/lib/contracts/annual-premium-from-monthly";
import { WizardShell, WizardHeader, WizardBody } from "@/app/components/wizard";

export function ContactContractModals({ contactId }: { contactId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const bundleQK = queryKeys.contacts.documentsBundle(contactId);

  const {
    data: bundleData,
    isPending: loading,
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

  const list = bundleData?.contracts ?? [];

  const invalidateContractsData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: bundleQK });
    void queryClient.invalidateQueries({ queryKey: queryKeys.contacts.contractDupPairs(contactId) });
  }, [queryClient, bundleQK, contactId]);

  const [editingId, setEditingId] = useState<string | null>(null);
  /** URL `add=1` je pravda; zavírání přes App Router je však asynchronní — bez tohoto zůstane modal otevřený, dokud nedorazí nová URL. */
  const urlWantsContractWizard = searchParams.get("add") === "1";
  const [wizardDismissedOptimistic, setWizardDismissedOptimistic] = useState(false);
  useEffect(() => {
    if (urlWantsContractWizard) setWizardDismissedOptimistic(false);
  }, [urlWantsContractWizard]);
  const wizardOpen = urlWantsContractWizard && !wizardDismissedOptimistic;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<ContractFormState>(() => initialContractFormState());
  const [pickerValue, setPickerValue] = useState<ProductPickerValue>({ partnerId: "", productId: "" });
  const [visibleToClientEdit, setVisibleToClientEdit] = useState(true);
  const [portfolioStatusEdit, setPortfolioStatusEdit] = useState("active");

  const clearAddQueryParam = useCallback(() => {
    if (searchParams.get("add") !== "1") return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("add");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const closeEdit = useCallback(() => {
    setEditingId(null);
    setSubmitError(null);
  }, []);

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

  const startEdit = useCallback((c: ContractRow) => {
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
  }, []);

  /** Deep link: ?edit=<contractId> (libovolná záložka kontaktu) */
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || loading) return;
    const c = list.find((x) => x.id === editId);
    if (!c) return;
    startEdit(c);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("edit");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, list, loading, pathname, router, startEdit]);

  useEffect(() => {
    if (!editingId || loading) return;
    if (!list.some((c) => c.id === editingId)) {
      setEditingId(null);
      setSubmitError(null);
    }
  }, [editingId, list, loading]);

  return (
    <>
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
        <WizardShell
          open
          onClose={closeEdit}
          title="Upravit smlouvu"
          focusContentKey={editingId}
        >
          <WizardHeader title="Upravit smlouvu" onClose={closeEdit} />
          <WizardBody withSlide={false}>
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
                  onClick={closeEdit}
                  className="rounded px-3 py-1.5 text-sm font-semibold border border-[color:var(--wp-border-strong)] text-[color:var(--wp-text-muted)]"
                >
                  Zrušit
                </button>
              </div>
            </form>
          </WizardBody>
        </WizardShell>
      ) : null}
    </>
  );
}
