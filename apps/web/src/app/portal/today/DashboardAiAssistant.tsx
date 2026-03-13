"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { useAiAssistantDrawer } from "@/app/portal/AiAssistantDrawerContext";
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
  const { setOpen: setAiDrawerOpen } = useAiAssistantDrawer();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="animate-pulse flex flex-col items-center gap-2">
          <Sparkles size={28} className="text-indigo-300" />
          <span className="text-sm text-indigo-200">Načítám…</span>
        </div>
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
          <button
            type="button"
            onClick={() => setAiDrawerOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm transition-colors min-h-[44px]"
          >
            <Sparkles size={18} />
            Otevřít asistenta
          </button>
        </div>
      </div>
    </div>
  );
}
