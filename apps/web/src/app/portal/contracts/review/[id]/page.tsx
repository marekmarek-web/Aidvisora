"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  approveContractReview,
  rejectContractReview,
  applyContractReviewDrafts,
  selectMatchedClient,
  confirmCreateNewClient,
} from "@/app/actions/contract-review";
import { useToast } from "@/app/components/Toast";
import { AIReviewExtractionShell } from "@/app/components/ai-review/AIReviewExtractionShell";
import { mapApiToExtractionDocument } from "@/lib/ai-review/mappers";
import type { ExtractionDocument } from "@/lib/ai-review/types";

export default function ContractReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const toast = useToast();

  const [doc, setDoc] = useState<ExtractionDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");

  const loadPdf = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/review/${id}/file`);
      if (res.ok) {
        const { url } = await res.json();
        if (url) setPdfUrl(url);
      }
    } catch {
      /* PDF URL optional */
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/review/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Položka nenalezena.");
        throw new Error("Načtení detailu selhalo.");
      }
      const data = await res.json();
      const mapped = mapApiToExtractionDocument(data, pdfUrl);
      setDoc(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }, [id, pdfUrl]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBack = useCallback(() => {
    router.push("/portal/contracts/review");
  }, [router]);

  const handleDiscard = useCallback(async () => {
    const msg = "Smazat soubor z úložiště i z revize? Tím odeberete dokument a související data.";
    if (!window.confirm(msg)) return;
    setActionLoading("delete");
    try {
      const res = await fetch(`/api/contracts/review/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.showToast(data.error ?? "Smazání selhalo.", "error");
        return;
      }
      toast.showToast("Položka smazána.", "success");
      router.push("/portal/contracts/review");
    } catch {
      toast.showToast("Smazání selhalo.", "error");
    } finally {
      setActionLoading(null);
    }
  }, [id, router, toast]);

  const handleApprove = useCallback(async () => {
    setActionLoading("approve");
    try {
      const result = await approveContractReview(id);
      if (result.ok) {
        toast.showToast("Položka schválena.", "success");
        load();
      } else {
        toast.showToast(result.error ?? "Chyba", "error");
      }
    } finally {
      setActionLoading(null);
    }
  }, [id, toast, load]);

  const handleReject = useCallback(
    async (reason?: string) => {
      setActionLoading("reject");
      try {
        const result = await rejectContractReview(id, reason || undefined);
        if (result.ok) {
          toast.showToast("Položka zamítnuta.", "success");
          load();
        } else {
          toast.showToast(result.error ?? "Chyba", "error");
        }
      } finally {
        setActionLoading(null);
      }
    },
    [id, toast, load]
  );

  const handleApply = useCallback(async () => {
    setActionLoading("apply");
    try {
      const result = await applyContractReviewDrafts(id);
      if (result.ok) {
        toast.showToast("Akce aplikovány do CRM.", "success");
        load();
      } else {
        toast.showToast(result.error ?? "Chyba", "error");
      }
    } finally {
      setActionLoading(null);
    }
  }, [id, toast, load]);

  const handleSelectClient = useCallback(
    async (clientId: string) => {
      setActionLoading("select");
      try {
        const result = await selectMatchedClient(id, clientId);
        if (result.ok) {
          toast.showToast("Klient vybrán.", "success");
          load();
        } else {
          toast.showToast(result.error ?? "Chyba", "error");
        }
      } finally {
        setActionLoading(null);
      }
    },
    [id, toast, load]
  );

  const handleConfirmCreateNew = useCallback(async () => {
    setActionLoading("createNew");
    try {
      const result = await confirmCreateNewClient(id);
      if (result.ok) {
        toast.showToast("Vytvoření nového klienta potvrzeno.", "success");
        load();
      } else {
        toast.showToast(result.error ?? "Chyba", "error");
      }
    } finally {
      setActionLoading(null);
    }
  }, [id, toast, load]);

  if (loading && !doc) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500">Načítám AI extrakci…</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-800">{error ?? "Dokument nenalezen."}</p>
          <button onClick={handleBack} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
            Zpět na seznam
          </button>
        </div>
      </div>
    );
  }

  return (
    <AIReviewExtractionShell
      doc={doc}
      onBack={handleBack}
      onDiscard={handleDiscard}
      onApprove={handleApprove}
      onReject={handleReject}
      onApply={handleApply}
      onSelectClient={handleSelectClient}
      onConfirmCreateNew={handleConfirmCreateNew}
      isApproving={actionLoading === "approve"}
      actionLoading={actionLoading}
    />
  );
}
