"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Send, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import type { UrgentItem, SuggestedAction, DashboardSummary } from "@/lib/ai/dashboard-types";

function getHref(action: SuggestedAction): string | null {
  if (action.type === "open_review" && action.payload.reviewId) {
    return `/portal/contracts/review/${action.payload.reviewId}`;
  }
  if (action.type === "view_client" && action.payload.clientId) {
    return `/portal/contacts/${action.payload.clientId}`;
  }
  if (action.type === "open_task") {
    return "/portal/tasks";
  }
  return null;
}

export function DashboardAiAssistant() {
  const router = useRouter();
  const toast = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState<{
    message: string;
    suggestedActions: SuggestedAction[];
    warnings: string[];
  } | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/dashboard-summary");
      if (!res.ok) throw new Error("Načtení shrnutí selhalo.");
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleSendChat = async () => {
    const msg = chatMessage.trim();
    if (!msg || chatLoading) return;
    setChatLoading(true);
    setChatResponse(null);
    try {
      const res = await fetch("/api/ai/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.showToast(data.error ?? "Odeslání selhalo.", "error");
        return;
      }
      setChatResponse({
        message: data.message ?? "",
        suggestedActions: data.suggestedActions ?? [],
        warnings: data.warnings ?? [],
      });
      setChatMessage("");
    } catch {
      toast.showToast("Odeslání zprávy selhalo.", "error");
    } finally {
      setChatLoading(false);
    }
  };

  const handleDraftEmail = async (clientId: string) => {
    try {
      const res = await fetch("/api/ai/assistant/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, context: "follow_up" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.showToast(data.error ?? "Návrh e-mailu selhal.", "error");
        return;
      }
      const text = `${data.subject}\n\n${data.body}`;
      await navigator.clipboard.writeText(text);
      toast.showToast("Návrh e-mailu zkopírován do schránky.", "success");
    } catch {
      toast.showToast("Kopírování selhalo.", "error");
    }
  };

  const handleAction = (action: SuggestedAction) => {
    const href = getHref(action);
    if (href) {
      router.push(href);
      return;
    }
    if (action.type === "draft_email" && action.payload.clientId) {
      handleDraftEmail(action.payload.clientId as string);
      return;
    }
    if (action.type === "create_task") {
      router.push("/portal/tasks");
    }
  };

  if (loading && !summary) {
    return (
      <div className="bg-gradient-to-br from-[#1a1c2e] to-indigo-950 p-6 rounded-[24px] text-white min-h-[240px] flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-indigo-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-[24px] border border-slate-200 p-6">
        <p className="text-sm text-rose-600 mb-2">{error}</p>
        <button
          type="button"
          onClick={loadSummary}
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          Zkusit znovu
        </button>
      </div>
    );
  }

  const topUrgent = (summary?.urgentItems ?? []).slice(0, 5);
  const suggestedActions = summary?.suggestedActions ?? [];

  return (
    <div className="bg-gradient-to-br from-[#1a1c2e] to-indigo-950 p-6 rounded-[24px] text-white shadow-xl shadow-indigo-900/10 relative overflow-hidden min-h-[280px] flex flex-col">
      <Sparkles className="absolute -top-6 -right-6 w-32 h-32 text-indigo-500/20" aria-hidden />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-indigo-500/30 rounded-lg text-indigo-300">
            <Sparkles size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-indigo-200">
            AI asistent
          </h3>
        </div>

        <p className="text-sm font-medium leading-relaxed text-indigo-50 mb-4 line-clamp-3">
          {summary?.assistantSummaryText ?? "Načítám…"}
        </p>

        {topUrgent.length > 0 && (
          <div className="mb-4 space-y-2">
            {topUrgent.map((u: UrgentItem) => (
              <Link
                key={`${u.type}-${u.entityId}`}
                href={
                  u.type === "review"
                    ? `/portal/contracts/review/${u.entityId}`
                    : u.type === "task"
                      ? "/portal/tasks"
                      : u.type === "client"
                        ? `/portal/contacts/${u.entityId}`
                        : "#"
                }
                className="flex items-center justify-between w-full px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-left text-sm border border-white/10"
              >
                <span className="truncate flex-1">{u.title}</span>
                <ArrowRight size={14} className="shrink-0 ml-2 text-indigo-300" />
              </Link>
            ))}
          </div>
        )}

        {suggestedActions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {suggestedActions.slice(0, 4).map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAction(a)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-indigo-100"
              >
                {a.label.length > 28 ? a.label.slice(0, 26) + "…" : a.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Zeptejte se asistenta…"
              className="flex-1 min-w-0 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-indigo-200/70 outline-none"
            />
            <button
              type="button"
              onClick={handleSendChat}
              disabled={chatLoading}
              className="shrink-0 p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
              aria-label="Odeslat"
            >
              {chatLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

      {chatResponse && (
        <div
          className="absolute inset-0 z-20 bg-[#1a1c2e]/95 rounded-[24px] p-6 overflow-y-auto flex flex-col"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold uppercase text-indigo-200">Odpověď</h4>
            <button
              type="button"
              onClick={() => setChatResponse(null)}
              className="text-indigo-300 hover:text-white text-sm"
            >
              Zavřít
            </button>
          </div>
          {chatResponse.warnings.length > 0 && (
            <div className="flex items-center gap-2 mb-2 text-amber-300 text-xs">
              <AlertCircle size={14} />
              {chatResponse.warnings.join(" ")}
            </div>
          )}
          <p className="text-sm text-indigo-50 whitespace-pre-wrap flex-1 mb-4">
            {chatResponse.message}
          </p>
          {chatResponse.suggestedActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chatResponse.suggestedActions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    handleAction(a);
                    setChatResponse(null);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-indigo-100"
                >
                  {a.label.length > 30 ? a.label.slice(0, 28) + "…" : a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
