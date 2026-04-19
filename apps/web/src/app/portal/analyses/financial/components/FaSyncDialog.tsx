"use client";

import { useState, useEffect } from "react";
import { getFaSyncPreview, syncFaToContacts } from "@/app/actions/fa-sync";
import { getHouseholdsList } from "@/app/actions/households";
import type { FaSyncPreview } from "@/lib/analyses/financial/contactSync";
import { useFinancialAnalysisStore } from "@/lib/analyses/financial/store";
import clsx from "clsx";
import { Users, UserPlus, Home, CheckCircle, AlertTriangle, Loader2, X, Baby } from "lucide-react";
import { portalPrimaryButtonClassName } from "@/lib/ui/create-action-button-styles";

const ROLE_LABELS: Record<string, string> = {
  primary: "Hlavní klient",
  partner: "Partner",
  child: "Dítě",
};

type HouseholdOption = { id: string; name: string };
type HouseholdMode = "new" | "existing" | "none";

export function FaSyncDialog({ analysisId, onClose, onDone }: {
  analysisId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<FaSyncPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [householdMode, setHouseholdMode] = useState<HouseholdMode>("new");
  const [householdName, setHouseholdName] = useState("");
  const [existingHouseholds, setExistingHouseholds] = useState<HouseholdOption[]>([]);
  const [existingHouseholdId, setExistingHouseholdId] = useState<string>("");
  const setData = useFinancialAnalysisStore((s) => s.setData);
  const saveToStorage = useFinancialAnalysisStore((s) => s.saveToStorage);

  useEffect(() => {
    setLoading(true);
    Promise.all([getFaSyncPreview(analysisId), getHouseholdsList().catch(() => [])])
      .then(([p, hh]) => {
        setPreview(p);
        if (p) {
          const initialSelected = new Set<number>();
          p.persons.forEach((person, i) => {
            if (person.selected) initialSelected.add(i);
          });
          setSelectedIndices(initialSelected);
          setHouseholdMode(p.createHousehold ? "new" : "none");
          setHouseholdName(p.householdName);
        }
        if (Array.isArray(hh)) {
          setExistingHouseholds(hh.map((h) => ({ id: h.id, name: h.name })));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Chyba načtení preview."))
      .finally(() => setLoading(false));
  }, [analysisId]);

  const togglePerson = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSync = async () => {
    if (!preview) return;
    setSyncing(true);
    setError(null);
    try {
      const result = await syncFaToContacts({
        analysisId,
        selectedPersonIndices: Array.from(selectedIndices),
        createHousehold: householdMode === "new",
        householdName,
        existingHouseholdId: householdMode === "existing" ? existingHouseholdId : undefined,
      });
      const primary = result.contactIds.find((c) => c.faRole === "primary");
      if (primary) {
        setData({ clientId: primary.contactId });
        if (result.householdId) setData({ householdId: result.householdId });
        saveToStorage();
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synchronizace selhala.");
    } finally {
      setSyncing(false);
    }
  };

  const canSubmit =
    selectedIndices.size > 0 &&
    (householdMode !== "existing" || Boolean(existingHouseholdId));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[color:var(--wp-surface-card)] rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[color:var(--wp-surface-card-border)]">
          <h3 className="text-lg font-black text-[color:var(--wp-text)] flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Synchronizovat klienty z FA
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[color:var(--wp-surface-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5 text-[color:var(--wp-text-secondary)]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-[color:var(--wp-text-secondary)]">Načítám preview...</span>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

          {preview && !loading && (
            <>
              <div className="space-y-2">
                {preview.persons.map((p, idx) => {
                  const isChildUnder18 = p.faRole === "child" && typeof p.age === "number" && p.age < 18;
                  return (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors min-h-[44px] ${
                        selectedIndices.has(idx)
                          ? "border-indigo-300 bg-indigo-50/50"
                          : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIndices.has(idx)}
                        onChange={() => togglePerson(idx)}
                        className="mt-0.5 w-5 h-5 rounded border-[color:var(--wp-border-strong)] text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[color:var(--wp-text)] text-sm">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--wp-surface-card-border)] text-[color:var(--wp-text-secondary)]">
                            {ROLE_LABELS[p.faRole] ?? p.faRole}
                          </span>
                          {p.faRole === "child" && typeof p.birthYear === "number" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                              ročník {p.birthYear}
                              {typeof p.age === "number" ? ` · ${p.age} let` : ""}
                            </span>
                          )}
                        </div>
                        {p.email && <p className="text-xs text-[color:var(--wp-text-secondary)]">{p.email}</p>}
                        {isChildUnder18 && (
                          <p className="text-xs text-[color:var(--wp-text-secondary)] flex items-center gap-1 mt-1">
                            <Baby className="w-3 h-3" />
                            Nezletilé dítě – kontakt se standardně nevytváří.
                          </p>
                        )}
                        {p.matchedContactId && (
                          <p className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            Nalezen v Aidvisoře (shoda: {p.matchReason}) – bude aktualizován
                          </p>
                        )}
                        {!p.matchedContactId && !isChildUnder18 && (
                          <p className="text-xs text-emerald-700 flex items-center gap-1 mt-1">
                            <UserPlus className="w-3 h-3" />
                            Nový kontakt
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {preview.persons.length > 1 && (
                <div className="p-3 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/50 space-y-3">
                  <div className="flex items-center gap-2 text-[color:var(--wp-text)]">
                    <Home className="w-4 h-4 text-[color:var(--wp-text-secondary)]" />
                    <span className="text-sm font-bold">Domácnost</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold ${
                      householdMode === "new" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text-secondary)]"
                    }`}>
                      <input type="radio" name="hhmode" checked={householdMode === "new"} onChange={() => setHouseholdMode("new")} className="accent-indigo-600" />
                      Vytvořit novou
                    </label>
                    <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold ${
                      householdMode === "existing" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text-secondary)]"
                    }`}>
                      <input type="radio" name="hhmode" checked={householdMode === "existing"} onChange={() => setHouseholdMode("existing")} className="accent-indigo-600" />
                      Použít existující
                    </label>
                    <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold ${
                      householdMode === "none" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text-secondary)]"
                    }`}>
                      <input type="radio" name="hhmode" checked={householdMode === "none"} onChange={() => setHouseholdMode("none")} className="accent-indigo-600" />
                      Bez domácnosti
                    </label>
                  </div>

                  {householdMode === "new" && (
                    <input
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      placeholder="Název domácnosti"
                      className="w-full px-3 py-2 rounded-lg border border-[color:var(--wp-surface-card-border)] text-sm min-h-[44px]"
                    />
                  )}

                  {householdMode === "existing" && (
                    existingHouseholds.length > 0 ? (
                      <select
                        value={existingHouseholdId}
                        onChange={(e) => setExistingHouseholdId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[color:var(--wp-surface-card-border)] text-sm min-h-[44px] bg-[color:var(--wp-surface-card)]"
                      >
                        <option value="">Vyberte domácnost…</option>
                        {existingHouseholds.map((h) => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-[color:var(--wp-text-secondary)]">Zatím nemáte žádné domácnosti.</p>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {preview && !loading && (
          <div className="flex justify-end gap-3 p-5 border-t border-[color:var(--wp-surface-card-border)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-bold border border-[color:var(--wp-surface-card-border)] text-[color:var(--wp-text-secondary)] bg-[color:var(--wp-surface-card)] hover:bg-[color:var(--wp-surface-muted)] min-h-[44px]"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || !canSubmit}
              className={clsx(portalPrimaryButtonClassName, "min-h-[44px] px-5 py-2.5 disabled:opacity-50")}
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {syncing ? "Synchronizuji…" : `Vytvořit ${selectedIndices.size} kontakt${selectedIndices.size === 1 ? "" : selectedIndices.size < 5 ? "y" : "ů"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
