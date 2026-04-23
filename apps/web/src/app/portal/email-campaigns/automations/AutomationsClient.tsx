"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AutomationRuleRow,
  AutomationStatsRow,
  AutomationTriggerType,
  UpsertAutomationInput,
} from "@/app/actions/email-automations";
import {
  upsertAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
} from "@/app/actions/email-automations";
import type { EmailTemplateRow } from "@/lib/email/template-repository";
import type { SegmentFilter } from "@/lib/email/segment-filter";
import SegmentBuilder from "../components/SegmentBuilder";

type Props = {
  initialRules: AutomationRuleRow[];
  initialStats: AutomationStatsRow[];
  templates: EmailTemplateRow[];
};

const TRIGGER_OPTIONS: Array<{
  id: AutomationTriggerType;
  label: string;
  hint: string;
  implemented: boolean;
}> = [
  {
    id: "birthday",
    label: "Narozeniny klienta",
    hint: "Odešle se N dní před / po narozeninách.",
    implemented: true,
  },
  {
    id: "inactive_client",
    label: "Neaktivní klient",
    hint: "Klient, se kterým nebyl kontakt X dnů.",
    implemented: true,
  },
  {
    id: "year_in_review",
    label: "Roční přehled",
    hint: "Shrnutí roku — odešle se v daný den.",
    implemented: true,
  },
  {
    id: "contract_anniversary",
    label: "Výročí smlouvy",
    hint: "Odešle se N dní před/po výročí sjednání smlouvy (roční opakování).",
    implemented: true,
  },
  {
    id: "proposal_accepted",
    label: "Přijetí návrhu",
    hint: "Odešle se N dní po přijetí návrhu (accepted proposal).",
    implemented: true,
  },
  {
    id: "contract_activated",
    label: "Aktivace smlouvy",
    hint: "Odešle se N dní po aktivaci smlouvy (portfolio_status = active).",
    implemented: true,
  },
  {
    id: "analysis_completed",
    label: "Dokončení analýzy",
    hint: "Odešle se po prodeji z analýzy (sold_partial / sold_full).",
    implemented: true,
  },
  {
    id: "service_due",
    label: "Blížící se servis",
    hint: "Odešle se N dní před plánovaným servisem klienta.",
    implemented: true,
  },
  {
    id: "referral_ask_after_proposal",
    label: "Žádost o doporučení po uzavření",
    hint: "14 dní po accepted návrhu s úsporou (konfigurovatelné).",
    implemented: true,
  },
  {
    id: "referral_ask_after_anniversary",
    label: "Žádost o doporučení k výročí spolupráce",
    hint: "Roční opakování k výročí založení klienta (client_since).",
    implemented: true,
  },
];

export default function AutomationsClient({ initialRules, initialStats, templates }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<AutomationRuleRow | "new" | null>(null);
  const [isPending, startTransition] = useTransition();

  const statsById = new Map(initialStats.map((s) => [s.ruleId, s]));

  const handleToggle = (rule: AutomationRuleRow, next: boolean) => {
    startTransition(async () => {
      await toggleAutomationRule(rule.id, next);
      router.refresh();
    });
  };

  const handleDelete = (rule: AutomationRuleRow) => {
    if (!confirm(`Smazat pravidlo „${rule.name}“?`)) return;
    startTransition(async () => {
      await deleteAutomationRule(rule.id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
          {initialRules.length} pravidel
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--wp-primary)] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[color:var(--wp-primary-hover)]"
        >
          + Nové pravidlo
        </button>
      </div>

      <div className="rounded-[var(--wp-radius-card)] border border-[color:var(--wp-surface-card-border)] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--wp-main-scroll-bg)] text-xs uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
            <tr>
              <th className="px-5 py-3 text-left">Název</th>
              <th className="px-5 py-3 text-left">Trigger</th>
              <th className="px-5 py-3 text-left">Šablona</th>
              <th className="px-5 py-3 text-right">30 dní</th>
              <th className="px-5 py-3 text-center">Stav</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--wp-surface-card-border)]">
            {initialRules.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-sm text-[color:var(--wp-text-tertiary)]"
                >
                  Zatím žádné automatizace. Klikněte na „Nové pravidlo“.
                </td>
              </tr>
            ) : (
              initialRules.map((rule) => {
                const s = statsById.get(rule.id);
                return (
                  <tr key={rule.id}>
                    <td className="px-5 py-3">
                      <p className="font-bold text-[color:var(--wp-text)]">{rule.name}</p>
                      {rule.description ? (
                        <p className="text-xs text-[color:var(--wp-text-tertiary)]">
                          {rule.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--wp-text-secondary)]">
                      {TRIGGER_OPTIONS.find((t) => t.id === rule.triggerType)?.label ??
                        rule.triggerType}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--wp-text-secondary)]">
                      {rule.templateName ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-[color:var(--wp-text-secondary)]">
                      {s ? (
                        <span className="text-xs font-bold">
                          {s.last30Queued} odesláno · {s.last30Skipped} skip ·{" "}
                          {s.last30Failed} chyb
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rule.isActive}
                          onChange={(e) => handleToggle(rule, e.target.checked)}
                          disabled={isPending}
                        />
                        <span className="text-xs font-bold">
                          {rule.isActive ? "Aktivní" : "Vypnuto"}
                        </span>
                      </label>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(rule)}
                        className="mr-1 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--wp-text)] hover:bg-[color:var(--wp-main-scroll-bg)]"
                      >
                        Upravit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <AutomationModal
          rule={editing === "new" ? null : editing}
          templates={templates}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AutomationModal({
  rule,
  templates,
  onClose,
  onSaved,
}: {
  rule: AutomationRuleRow | null;
  templates: EmailTemplateRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(
    (rule?.triggerType as AutomationTriggerType) ?? "birthday",
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    rule?.triggerConfig ?? {},
  );
  const [templateId, setTemplateId] = useState<string>(rule?.templateId ?? templates[0]?.id ?? "");
  const [offsetDays, setOffsetDays] = useState<number>(rule?.scheduleOffsetDays ?? 0);
  const [sendHour, setSendHour] = useState<number>(rule?.sendHour ?? 9);
  const [isActive, setIsActive] = useState<boolean>(rule?.isActive ?? false);
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter | null>(
    rule?.segmentFilter ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: UpsertAutomationInput = {
        id: rule?.id,
        name,
        description: description || null,
        triggerType,
        triggerConfig,
        segmentFilter,
        templateId,
        scheduleOffsetDays: offsetDays,
        sendHour,
        isActive,
      };
      await upsertAutomationRule(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--wp-radius-card)] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-black text-[color:var(--wp-text)]">
            {rule ? "Upravit pravidlo" : "Nové automatizační pravidlo"}
          </h2>
          <button type="button" onClick={onClose} className="text-xl font-bold text-[color:var(--wp-text-tertiary)] hover:text-[color:var(--wp-text)]">
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Název
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              placeholder="Např. Přání k narozeninám"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Popis (volitelné)
            </label>
            <textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Trigger
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as AutomationTriggerType)}
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
            >
              {TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={!opt.implemented}>
                  {opt.label} {opt.implemented ? "" : "(připravuje se)"}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[color:var(--wp-text-tertiary)]">
              {TRIGGER_OPTIONS.find((t) => t.id === triggerType)?.hint ?? ""}
            </p>
          </div>

          {triggerType === "inactive_client" ? (
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Dní bez interakce
              </label>
              <input
                type="number"
                min={30}
                value={Number(triggerConfig.days ?? 180)}
                onChange={(e) =>
                  setTriggerConfig((tc) => ({ ...tc, days: Number(e.target.value) }))
                }
                className="w-32 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              />
            </div>
          ) : null}

          {triggerType === "year_in_review" ? (
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Datum odeslání (měsíc-den)
              </label>
              <input
                type="text"
                value={String(triggerConfig.month_day ?? "12-15")}
                onChange={(e) =>
                  setTriggerConfig((tc) => ({ ...tc, month_day: e.target.value }))
                }
                placeholder="12-15"
                className="w-32 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Posun (dny)
              </label>
              <input
                type="number"
                min={-30}
                max={30}
                value={offsetDays}
                onChange={(e) => setOffsetDays(Number(e.target.value))}
                className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              />
              <p className="mt-1 text-xs text-[color:var(--wp-text-tertiary)]">
                0 = dnes, -3 = 3 dny dopředu, +7 = 7 dní po
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Hodina odeslání
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={sendHour}
                onChange={(e) => setSendHour(Number(e.target.value))}
                className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Šablona
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Segment (volitelně — zúžení cílové skupiny)
            </label>
            <SegmentBuilder value={segmentFilter} onChange={setSegmentFilter} />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="text-sm font-bold">Aktivovat pravidlo</span>
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-4 py-2 text-sm font-bold text-[color:var(--wp-text)]"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !name.trim() || !templateId}
              className="rounded-xl bg-[color:var(--wp-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
