"use client";

/**
 * Admin control surface for AI Photo / Image Intake (Phase 8).
 *
 * Provides:
 * - Feature flag toggles (tenant-scoped, global_admin only)
 * - Runtime config overrides (TTL, limits, enable flags)
 * - Intent-assist cache stats
 * - Read-only config summary with source attribution
 *
 * Access: requires settings:write permission (same as ai-quality page).
 * All mutations are audited via logConfigChange.
 */

import { useEffect, useState, useCallback } from "react";
import {
  getImageIntakeAdminState,
  setImageIntakeFeatureFlag,
  clearImageIntakeFeatureFlag,
  setImageIntakeConfigValue,
  type ImageIntakeAdminState,
} from "@/app/actions/admin-image-intake";

type ActiveTab = "flags" | "config" | "cache";

function Badge({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
        on
          ? "bg-emerald-100 text-emerald-800"
          : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)]"
      }`}
    >
      {on ? "Zapnuto" : "Vypnuto"}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">
      {children}
    </h2>
  );
}

const FLAG_LABELS: Record<string, string> = {
  image_intake_enabled: "Image Intake (master)",
  image_intake_combined_multimodal: "Combined multi-image pass",
  image_intake_intent_assist: "Intent-change model assist",
  image_intake_handoff_queue: "AI Review handoff queue submit",
  image_intake_cross_session_persistence: "Cross-session DB persistence",
};

const FLAG_CODES = Object.keys(FLAG_LABELS) as Array<keyof typeof FLAG_LABELS>;

export default function ImageIntakeAdminPage() {
  const [state, setState] = useState<ImageIntakeAdminState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("flags");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getImageIntakeAdminState()
      .then(setState)
      .catch(() => setError("Nepodařilo se načíst stav image intake."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFlagToggle = useCallback(async (flagCode: string, currentValue: boolean) => {
    setSaving(flagCode);
    setSaveError(null);
    const res = await setImageIntakeFeatureFlag(flagCode, !currentValue);
    if (res.ok) {
      setState((prev) => {
        if (!prev) return prev;
        const flagKeyMap: Record<string, keyof ImageIntakeAdminState["flags"]> = {
          image_intake_enabled: "enabled",
          image_intake_combined_multimodal: "combinedMultimodal",
          image_intake_intent_assist: "intentAssist",
          image_intake_handoff_queue: "handoffQueueSubmit",
          image_intake_cross_session_persistence: "crossSessionPersistence",
        };
        const key = flagKeyMap[flagCode];
        if (!key) return prev;
        return { ...prev, flags: { ...prev.flags, [key]: !currentValue } };
      });
    } else {
      setSaveError(res.error ?? "Uložení selhalo.");
    }
    setSaving(null);
  }, []);

  const handleClearFlag = useCallback(async (flagCode: string) => {
    setSaving(`clear_${flagCode}`);
    setSaveError(null);
    const res = await clearImageIntakeFeatureFlag(flagCode);
    if (res.ok) load();
    else setSaveError(res.error ?? "Reset selhalo.");
    setSaving(null);
  }, [load]);

  const handleConfigBoolToggle = useCallback(async (
    key: "intent_assist_enabled" | "cross_session_persistence_enabled" | "handoff_queue_submit_enabled",
    currentValue: boolean,
  ) => {
    setSaving(key);
    setSaveError(null);
    const res = await setImageIntakeConfigValue(key, !currentValue);
    if (res.ok) load();
    else setSaveError(res.error ?? "Uložení selhalo.");
    setSaving(null);
  }, [load]);

  if (loading) {
    return (
      <div className="p-8 text-[color:var(--wp-text-secondary)] text-sm">Načítám…</div>
    );
  }

  if (error || !state) {
    return (
      <div className="p-8 text-red-600 text-sm">{error ?? "Nepodařilo se načíst stav."}</div>
    );
  }

  const flagValues: Record<string, boolean> = {
    image_intake_enabled: state.flags.enabled,
    image_intake_combined_multimodal: state.flags.combinedMultimodal,
    image_intake_intent_assist: state.flags.intentAssist,
    image_intake_handoff_queue: state.flags.handoffQueueSubmit,
    image_intake_cross_session_persistence: state.flags.crossSessionPersistence,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-black text-[color:var(--wp-text)]">Image Intake — Admin</h1>
        <div className="flex gap-2">
          {(["flags", "config", "cache"] as ActiveTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                activeTab === t
                  ? "bg-indigo-600 text-white"
                  : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)] hover:bg-[color:var(--wp-surface-card-border)]"
              }`}
            >
              {t === "flags" ? "Feature flags" : t === "config" ? "Runtime config" : "Cache"}
            </button>
          ))}
        </div>
      </div>

      {saveError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{saveError}</div>
      )}

      {/* Feature flags tab */}
      {activeTab === "flags" && (
        <div className="space-y-3">
          <SectionTitle>Tenant feature flags</SectionTitle>
          <p className="text-xs text-[color:var(--wp-text-secondary)]">
            Změna vyžaduje roli global_admin. Override je runtime (in-process); po restartu serveru se vrátí na defaultní hodnotu z env.
          </p>
          <div className="divide-y divide-[color:var(--wp-surface-card-border)] rounded-xl border border-[color:var(--wp-surface-card-border)]">
            {FLAG_CODES.map((flagCode) => {
              const currentValue = flagValues[flagCode] ?? false;
              const isSaving = saving === flagCode;
              return (
                <div key={flagCode} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--wp-text)]">
                      {FLAG_LABELS[flagCode]}
                    </p>
                    <p className="text-xs text-[color:var(--wp-text-secondary)]">{flagCode}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge on={currentValue} />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleFlagToggle(flagCode, currentValue)}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50 hover:bg-indigo-700"
                    >
                      {isSaving ? "…" : currentValue ? "Vypnout" : "Zapnout"}
                    </button>
                    <button
                      type="button"
                      disabled={saving === `clear_${flagCode}`}
                      onClick={() => handleClearFlag(flagCode)}
                      className="rounded-lg border border-[color:var(--wp-surface-card-border)] px-2 py-1 text-xs text-[color:var(--wp-text-secondary)] disabled:opacity-50 hover:bg-[color:var(--wp-surface-muted)]"
                      title="Reset na default"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Runtime config tab */}
      {activeTab === "config" && (
        <div className="space-y-4">
          <SectionTitle>Runtime config</SectionTitle>
          <p className="text-xs text-[color:var(--wp-text-secondary)]">
            Priority: runtime override (tato stránka) → env var → default. Hodnoty se neuloží do DB; resetují se restartem serveru.
          </p>

          {/* Boolean toggles */}
          <div className="space-y-2">
            {(
              [
                ["intent_assist_enabled", "Intent assist povoleno", state.config.intentAssistEnabled],
                ["cross_session_persistence_enabled", "Cross-session DB persistence", state.config.crossSessionPersistenceEnabled],
                ["handoff_queue_submit_enabled", "Handoff queue submit", state.config.handoffQueueSubmitEnabled],
              ] as [
                "intent_assist_enabled" | "cross_session_persistence_enabled" | "handoff_queue_submit_enabled",
                string,
                boolean,
              ][]
            ).map(([key, label, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-[color:var(--wp-surface-card-border)] p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-[color:var(--wp-text)]">{label}</p>
                  <p className="text-xs text-[color:var(--wp-text-secondary)]">{key}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge on={value} />
                  <button
                    type="button"
                    disabled={saving === key}
                    onClick={() => handleConfigBoolToggle(key, value)}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50 hover:bg-indigo-700"
                  >
                    {saving === key ? "…" : value ? "Vypnout" : "Zapnout"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Numeric config summary */}
          <div className="rounded-xl border border-[color:var(--wp-surface-card-border)] divide-y divide-[color:var(--wp-surface-card-border)]">
            <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs font-bold text-[color:var(--wp-text-secondary)] uppercase">
              <span>Klíč</span><span>Hodnota</span><span>Zdroj</span>
            </div>
            {state.configSummary.map(({ key, value, source }) => (
              <div key={key} className="grid grid-cols-3 gap-2 px-4 py-2 text-xs">
                <span className="font-mono text-[color:var(--wp-text)]">{key}</span>
                <span className="font-semibold text-[color:var(--wp-text)]">{String(value)}</span>
                <span className={source === "override" ? "font-bold text-indigo-600" : "text-[color:var(--wp-text-secondary)]"}>
                  {source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cache tab */}
      {activeTab === "cache" && (
        <div className="space-y-4">
          <SectionTitle>Intent-assist cache</SectionTitle>
          <div className="rounded-xl border border-[color:var(--wp-surface-card-border)] divide-y divide-[color:var(--wp-surface-card-border)]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-[color:var(--wp-text)]">Počet záznamů</span>
              <span className="font-mono text-sm text-[color:var(--wp-text)]">
                {state.cacheStats.size} / {state.cacheStats.maxSize}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-[color:var(--wp-text)]">TTL</span>
              <span className="font-mono text-sm text-[color:var(--wp-text)]">
                {state.cacheStats.ttlMs / 60000} min
              </span>
            </div>
          </div>
          <p className="text-xs text-[color:var(--wp-text-secondary)]">
            Cache je in-process (neresetuje se automaticky, resetuje se restartem serveru nebo přirozeným TTL eviction).
          </p>
        </div>
      )}
    </div>
  );
}
