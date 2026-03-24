"use client";

import React, { useReducer, useCallback, useEffect, useState } from "react";
import {
  FileText,
  Eye,
  AlertCircle,
  UserPlus,
  Check,
  Send,
  X,
  Trash2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import type {
  ExtractionDocument,
  ExtractionReviewState,
  ExtractionReviewAction,
  AIRecommendation,
  FieldFilter,
} from "@/lib/ai-review/types";
import { AIReviewTopBar } from "./AIReviewTopBar";
import { ExtractionLeftPanel } from "./ExtractionLeftPanel";
import { PDFViewerPanel } from "./PDFViewerPanel";

const initialState: ExtractionReviewState = {
  activeFieldId: null,
  activePage: 1,
  zoomLevel: 100,
  filter: "all",
  collapsedGroups: {},
  dismissedRecommendations: {},
  editedFields: {},
  confirmedFields: {},
  isFullscreen: false,
  showPdfOnMobile: false,
};

function reducer(
  state: ExtractionReviewState,
  action: ExtractionReviewAction
): ExtractionReviewState {
  switch (action.type) {
    case "SET_ACTIVE_FIELD":
      return {
        ...state,
        activeFieldId: action.fieldId,
        activePage: action.page ?? state.activePage,
      };
    case "SET_PAGE":
      return { ...state, activePage: action.page };
    case "SET_ZOOM":
      return { ...state, zoomLevel: action.level };
    case "SET_FILTER":
      return { ...state, filter: action.filter };
    case "TOGGLE_GROUP":
      return {
        ...state,
        collapsedGroups: {
          ...state.collapsedGroups,
          [action.groupId]: !state.collapsedGroups[action.groupId],
        },
      };
    case "DISMISS_RECOMMENDATION":
      return {
        ...state,
        dismissedRecommendations: {
          ...state.dismissedRecommendations,
          [action.recId]: true,
        },
      };
    case "RESTORE_RECOMMENDATION": {
      const next = { ...state.dismissedRecommendations };
      delete next[action.recId];
      return { ...state, dismissedRecommendations: next };
    }
    case "EDIT_FIELD":
      return {
        ...state,
        editedFields: { ...state.editedFields, [action.fieldId]: action.value },
      };
    case "CONFIRM_FIELD":
      return {
        ...state,
        confirmedFields: { ...state.confirmedFields, [action.fieldId]: true },
      };
    case "REVERT_FIELD": {
      const nextEdited = { ...state.editedFields };
      delete nextEdited[action.fieldId];
      const nextConfirmed = { ...state.confirmedFields };
      delete nextConfirmed[action.fieldId];
      return { ...state, editedFields: nextEdited, confirmedFields: nextConfirmed };
    }
    case "SET_FULLSCREEN":
      return { ...state, isFullscreen: action.isFullscreen };
    case "SET_SHOW_PDF_MOBILE":
      return { ...state, showPdfOnMobile: action.show };
    default:
      return state;
  }
}

type Props = {
  doc: ExtractionDocument;
  onBack: () => void;
  onDiscard: () => void;
  onApprove: () => void;
  onReject?: (reason?: string) => void;
  onApply?: () => void;
  onSelectClient?: (clientId: string) => void;
  onConfirmCreateNew?: () => void;
  isApproving?: boolean;
  actionLoading?: string | null;
};

export function AIReviewExtractionShell({
  doc,
  onBack,
  onDiscard,
  onApprove,
  onReject,
  onApply,
  onSelectClient,
  onConfirmCreateNew,
  isApproving,
  actionLoading,
}: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  const isFailed = doc.processingStatus === "failed";
  const isProcessing = doc.processingStatus === "uploaded" || doc.processingStatus === "processing";
  const hasData = doc.groups.length > 0;
  const isPending = doc.reviewStatus === "pending" || !doc.reviewStatus;
  const canApproveReject =
    isPending && (doc.processingStatus === "extracted" || doc.processingStatus === "review_required");
  const isApproved = doc.reviewStatus === "approved";
  const hasResolvedClient = !!doc.matchedClientId || doc.createNewClientConfirmed === "true";
  const canApply = isApproved && hasResolvedClient && !doc.isApplied;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.isFullscreen) {
        dispatch({ type: "SET_FULLSCREEN", isFullscreen: false });
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [state.isFullscreen]);

  const handleFieldClick = useCallback((fieldId: string, page?: number) => {
    dispatch({ type: "SET_ACTIVE_FIELD", fieldId, page });
  }, []);

  const handleHighlightClick = useCallback((fieldId: string) => {
    dispatch({ type: "SET_ACTIVE_FIELD", fieldId });
  }, []);

  const handleEdit = useCallback((fieldId: string, value: string) => {
    dispatch({ type: "EDIT_FIELD", fieldId, value });
  }, []);

  const handleConfirm = useCallback((fieldId: string) => {
    dispatch({ type: "CONFIRM_FIELD", fieldId });
  }, []);

  const handleRevert = useCallback((fieldId: string) => {
    dispatch({ type: "REVERT_FIELD", fieldId });
  }, []);

  const handleFilterChange = useCallback((filter: FieldFilter) => {
    dispatch({ type: "SET_FILTER", filter });
  }, []);

  const handleToggleGroup = useCallback((groupId: string) => {
    dispatch({ type: "TOGGLE_GROUP", groupId });
  }, []);

  const handleDismissRec = useCallback((id: string) => {
    dispatch({ type: "DISMISS_RECOMMENDATION", recId: id });
  }, []);

  const handleRestoreRec = useCallback((id: string) => {
    dispatch({ type: "RESTORE_RECOMMENDATION", recId: id });
  }, []);

  const handleCreateTask = useCallback((_rec: AIRecommendation) => {
    // TODO: wire to actual task creation flow
  }, []);

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-[#f8fafc] font-sans text-slate-800 overflow-hidden -m-4 md:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800;900&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      `}</style>

      <AIReviewTopBar
        doc={doc}
        onBack={onBack}
        onDiscard={onDiscard}
        onApprove={onApprove}
        isApproving={isApproving}
        canApproveReject={canApproveReject}
        canApply={canApply}
        isApplied={doc.isApplied}
        onReject={() => setShowRejectModal(true)}
        onApply={() => setShowApplyConfirm(true)}
        actionLoading={actionLoading}
      />

      {/* Failed state banner */}
      {isFailed && doc.errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-start gap-3">
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-900 mb-1">Extrakce selhala</h4>
              <p className="text-xs text-rose-800 leading-relaxed">{doc.errorMessage}</p>
              <p className="text-xs text-rose-600 mt-1">
                Možné příčiny: PDF je naskenované (obrázek) a model neumí text rozpoznat, dokument je poškozený, nebo došlo k chybě API.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm font-bold text-blue-900">Dokument se zpracovává…</p>
          </div>
        </div>
      )}

      {/* Applied state */}
      {doc.isApplied && doc.applyResultPayload && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-4">
          <div className="max-w-5xl mx-auto">
            <h4 className="text-sm font-bold text-emerald-900 mb-2">Aplikováno do CRM</h4>
            <div className="flex flex-wrap gap-2 text-xs text-emerald-800">
              {doc.applyResultPayload.createdClientId && <span>Klient vytvořen</span>}
              {doc.applyResultPayload.createdContractId && <span>Smlouva vytvořena</span>}
              {doc.applyResultPayload.createdTaskId && <span>Úkol vytvořen</span>}
            </div>
            {doc.applyResultPayload.bridgeSuggestions?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {doc.applyResultPayload.bridgeSuggestions.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Mobile tab switcher */}
      <div className="lg:hidden flex border-b border-slate-200 bg-white">
        <button
          onClick={() => dispatch({ type: "SET_SHOW_PDF_MOBILE", show: false })}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest text-center transition-colors ${
            !state.showPdfOnMobile
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500"
          }`}
        >
          <FileText size={14} className="inline-block mr-1.5 -mt-0.5" />
          Extrakce
        </button>
        <button
          onClick={() => dispatch({ type: "SET_SHOW_PDF_MOBILE", show: true })}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest text-center transition-colors ${
            state.showPdfOnMobile
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500"
          }`}
        >
          <Eye size={14} className="inline-block mr-1.5 -mt-0.5" />
          PDF Náhled
        </button>
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <section
          className={`w-full lg:w-[55%] flex flex-col bg-[#f4f7f9] border-r border-slate-200 ${
            state.showPdfOnMobile ? "hidden lg:flex" : "flex"
          }`}
        >
          {hasData ? (
            <ExtractionLeftPanel
              doc={doc}
              state={state}
              onFieldClick={handleFieldClick}
              onEdit={handleEdit}
              onConfirm={handleConfirm}
              onRevert={handleRevert}
              onFilterChange={handleFilterChange}
              onToggleGroup={handleToggleGroup}
              onDismissRec={handleDismissRec}
              onRestoreRec={handleRestoreRec}
              onCreateTask={handleCreateTask}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <FileText size={28} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  {isFailed ? "Extrakce se nezdařila" : isProcessing ? "Zpracovávám…" : "Žádná data"}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {isFailed
                    ? "AI nedokázala z dokumentu extrahovat data. Zkuste nahrát čitelnější verzi dokumentu nebo jiný formát."
                    : isProcessing
                      ? "Dokument se právě zpracovává. Extrahovaná data se zobrazí automaticky."
                      : "Dokument zatím neobsahuje extrahovaná data."}
                </p>
              </div>
            </div>
          )}

          {/* Client match + actions at bottom of left panel */}
          {!doc.isApplied && (doc.clientMatchCandidates.length > 0 || canApproveReject || canApply) && hasData && (
            <div className="border-t border-slate-200 bg-white p-4 md:p-6 space-y-4 shrink-0">
              {/* Client candidates */}
              {doc.clientMatchCandidates.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Kandidáti klientů
                  </h4>
                  <div className="space-y-2">
                    {doc.clientMatchCandidates.map((c) => (
                      <div
                        key={c.clientId}
                        className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {c.displayName ?? c.clientId}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {Math.round(c.score * 100)}% · {c.reasons.join(", ")}
                          </p>
                        </div>
                        <button
                          onClick={() => onSelectClient?.(c.clientId)}
                          disabled={!!actionLoading || doc.matchedClientId === c.clientId}
                          className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[44px] ${
                            doc.matchedClientId === c.clientId
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {doc.matchedClientId === c.clientId ? (
                            <span className="flex items-center gap-1"><Check size={14} /> Vybrán</span>
                          ) : "Vybrat"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={onConfirmCreateNew}
                    disabled={!!actionLoading || doc.createNewClientConfirmed === "true"}
                    className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors min-h-[44px]"
                  >
                    <UserPlus size={14} />
                    {doc.createNewClientConfirmed === "true"
                      ? "Nový klient potvrzen"
                      : "Vytvořit nového klienta"}
                  </button>
                </div>
              )}

              {doc.clientMatchCandidates.length === 0 && (
                <button
                  onClick={onConfirmCreateNew}
                  disabled={!!actionLoading || doc.createNewClientConfirmed === "true"}
                  className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors min-h-[44px]"
                >
                  <UserPlus size={14} />
                  {doc.createNewClientConfirmed === "true"
                    ? "Nový klient potvrzen"
                    : "Žádný kandidát — vytvořit nového klienta"}
                </button>
              )}
            </div>
          )}

          {/* Danger zone — delete */}
          {!doc.isApplied && (
            <div className="border-t border-slate-200 bg-white px-4 md:px-6 py-3 shrink-0">
              <button
                onClick={onDiscard}
                disabled={actionLoading === "delete"}
                className="flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors min-h-[44px]"
              >
                {actionLoading === "delete" ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Smazat dokument
              </button>
            </div>
          )}
        </section>

        {/* Right panel */}
        <aside
          className={`w-full lg:w-[45%] flex flex-col ${
            state.showPdfOnMobile ? "flex" : "hidden lg:flex"
          }`}
        >
          <PDFViewerPanel
            doc={doc}
            activeFieldId={state.activeFieldId}
            activePage={state.activePage}
            zoomLevel={state.zoomLevel}
            isFullscreen={state.isFullscreen}
            onZoomChange={(level) => dispatch({ type: "SET_ZOOM", level })}
            onPageChange={(page) => dispatch({ type: "SET_PAGE", page })}
            onFullscreenToggle={() =>
              dispatch({ type: "SET_FULLSCREEN", isFullscreen: !state.isFullscreen })
            }
            onHighlightClick={handleHighlightClick}
          />
        </aside>
      </main>

      {/* Reject modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="rounded-2xl bg-white border border-slate-200 p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Zamítnout extrakci</h3>
            <label className="block text-sm text-slate-600 mt-2">Důvod (volitelné)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full mt-1 rounded-xl border border-slate-200 p-3 text-sm min-h-[88px] focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none"
              placeholder="Např. špatná smlouva, duplicita…"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 min-h-[44px] rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Zrušit
              </button>
              <button
                onClick={() => {
                  onReject?.(rejectReason);
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                disabled={actionLoading === "reject"}
                className="px-4 min-h-[44px] rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                {actionLoading === "reject" ? "Zamítám…" : "Zamítnout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply confirm modal */}
      {showApplyConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowApplyConfirm(false)}
        >
          <div
            className="rounded-2xl bg-white border border-slate-200 p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Aplikovat do CRM?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Návrhové akce (klient, smlouva, úkol…) budou zapsány do CRM. Tuto akci lze provést jen jednou.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowApplyConfirm(false)}
                className="px-4 min-h-[44px] rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Zrušit
              </button>
              <button
                onClick={() => {
                  onApply?.();
                  setShowApplyConfirm(false);
                }}
                disabled={actionLoading === "apply"}
                className="px-4 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading === "apply" ? "Aplikuji…" : "Aplikovat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
