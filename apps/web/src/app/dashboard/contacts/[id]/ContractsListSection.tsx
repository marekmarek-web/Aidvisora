"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchContactDocumentsBundle } from "@/app/dashboard/contacts/contact-documents-bundle";
import {
  deleteContract,
  approveContractForClientPortal,
  getContractAiProvenance,
} from "@/app/actions/contracts";
import type { ContractRow, ContractAiProvenanceResult } from "@/app/actions/contracts";
import {
  getPotentialDuplicateContractPairs,
  mergeDuplicateContracts,
} from "@/app/actions/contract-dedup";
import { EUCS_ZP_DISCLAIMER } from "@/data/insurance-ratings";
import { ConfirmDeleteModal } from "@/app/components/ConfirmDeleteModal";
import { ScrollText } from "lucide-react";
import Link from "next/link";
import { mapContractToCanonicalProduct } from "@/lib/client-portfolio/canonical-contract-read";
import { CanonicalProductAdvisorOverviewCard } from "./CanonicalProductAdvisorOverviewCard";

export function ContractsListSection({ contactId }: { contactId: string }) {
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

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [mergeBusyKey, setMergeBusyKey] = useState<string | null>(null);

  const openAddWizardInUrl = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("add", "1");
    p.delete("edit");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openEditInUrl = useCallback(
    (c: ContractRow) => {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("add");
      p.set("edit", c.id);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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
      setDeleteConfirmId(null);
    } finally {
      setDeletePending(false);
    }
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
                onEdit={() => openEditInUrl(c)}
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
                onEdit={() => openEditInUrl(c)}
                onDelete={() => setDeleteConfirmId(c.id)}
                onApproveForClient={() => void handleApproveForClient(c.id)}
                publishBusy={publishBusyId === c.id}
              />
            ))}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => openAddWizardInUrl()}
        className="rounded-[var(--wp-radius)] px-4 py-2.5 text-sm font-semibold bg-[var(--wp-accent)] text-white hover:opacity-90 min-h-[44px]"
      >
        + Přidat produkt / smlouvu
      </button>
    </div>
  );
}
