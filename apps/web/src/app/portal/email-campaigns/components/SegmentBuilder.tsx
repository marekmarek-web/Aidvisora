"use client";

import { useEffect, useState, useTransition } from "react";
import type { SegmentFilter, SegmentRule } from "@/lib/email/segment-filter";
import { SEGMENT_FIELDS } from "@/lib/email/segment-filter";
import { previewSegmentCount } from "@/app/actions/email-segments";

type Props = {
  value: SegmentFilter | null;
  onChange: (next: SegmentFilter | null) => void;
  /** Skrýt panel preview (např. pro formuláře automatizací). */
  hidePreview?: boolean;
};

const DEFAULT_RULE: SegmentRule = { field: "tag", op: "includes", value: "" };

export default function SegmentBuilder({ value, onChange, hidePreview }: Props) {
  const filter: SegmentFilter = value ?? { operator: "AND", rules: [] };
  const [preview, setPreview] = useState<{ count: number; sampleNames: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (hidePreview) return;
    if (filter.rules.length === 0) {
      setPreview(null);
      return;
    }
    startTransition(async () => {
      try {
        const res = await previewSegmentCount(filter);
        setPreview(res);
      } catch {
        setPreview(null);
      }
    });
  }, [JSON.stringify(filter), hidePreview]);

  const setOperator = (op: "AND" | "OR") => onChange({ ...filter, operator: op });

  const addRule = () =>
    onChange({ ...filter, rules: [...filter.rules, { ...DEFAULT_RULE }] });

  const updateRule = (idx: number, next: SegmentRule) => {
    const rules = [...filter.rules];
    rules[idx] = next;
    onChange({ ...filter, rules });
  };

  const removeRule = (idx: number) => {
    const rules = filter.rules.filter((_, i) => i !== idx);
    onChange(rules.length === 0 ? null : { ...filter, rules });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
          Kombinace
        </label>
        <div className="inline-flex overflow-hidden rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white">
          {(["AND", "OR"] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setOperator(op)}
              className={`px-3 py-1.5 text-xs font-bold ${
                filter.operator === op
                  ? "bg-[color:var(--wp-primary)] text-white"
                  : "text-[color:var(--wp-text-secondary)]"
              }`}
            >
              {op === "AND" ? "Všechny" : "Jakékoliv"}
            </button>
          ))}
        </div>
        <span className="text-xs text-[color:var(--wp-text-tertiary)]">
          {filter.operator === "AND"
            ? "Kontakt musí splnit všechny podmínky"
            : "Stačí, když splní alespoň jednu"}
        </span>
      </div>

      <div className="space-y-2">
        {filter.rules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-main-scroll-bg)] px-3 py-3 text-xs text-[color:var(--wp-text-tertiary)]">
            Žádná pravidla — segment odpovídá všem příjemcům.
          </p>
        ) : (
          filter.rules.map((rule, idx) => (
            <RuleRow
              key={idx}
              rule={rule}
              onChange={(next) => updateRule(idx, next)}
              onRemove={() => removeRule(idx)}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={addRule}
        className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--wp-text)] hover:bg-[color:var(--wp-main-scroll-bg)]"
      >
        + Přidat podmínku
      </button>

      {!hidePreview && preview ? (
        <div className="mt-2 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-main-scroll-bg)] px-3 py-2 text-xs">
          <p className="font-bold text-[color:var(--wp-text)]">
            Vyhovuje <span className="text-[color:var(--wp-primary)]">{preview.count}</span>{" "}
            kontaktů{isPending ? " (přepočítávám…)" : ""}
          </p>
          {preview.sampleNames.length > 0 ? (
            <p className="mt-1 text-[color:var(--wp-text-tertiary)]">
              Náhled: {preview.sampleNames.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: SegmentRule;
  onChange: (next: SegmentRule) => void;
  onRemove: () => void;
}) {
  const def = SEGMENT_FIELDS.find((f) => f.field === rule.field) ?? SEGMENT_FIELDS[0]!;

  const changeField = (nextField: SegmentRule["field"]) => {
    const nextDef = SEGMENT_FIELDS.find((f) => f.field === nextField)!;
    const firstOp = nextDef.ops[0]!.id;
    let val: unknown = "";
    if (nextDef.valueType === "boolean") val = true;
    else if (nextDef.valueType === "number" || nextDef.valueType === "month") val = 1;
    onChange({ field: nextField, op: firstOp, value: val } as SegmentRule);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2">
      <select
        value={rule.field}
        onChange={(e) => changeField(e.target.value as SegmentRule["field"])}
        className="min-w-[140px] rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-2 py-1 text-xs font-bold"
      >
        {SEGMENT_FIELDS.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        value={rule.op}
        onChange={(e) =>
          onChange({ ...rule, op: e.target.value as SegmentRule["op"] } as SegmentRule)
        }
        className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-2 py-1 text-xs font-bold"
      >
        {def.ops.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <RuleValueInput rule={rule} onChange={onChange} valueType={def.valueType} />

      <button
        type="button"
        onClick={onRemove}
        className="ml-auto rounded-lg p-1 text-[color:var(--wp-text-tertiary)] hover:bg-[color:var(--wp-main-scroll-bg)] hover:text-rose-600"
        aria-label="Odebrat podmínku"
        title="Odebrat podmínku"
      >
        ×
      </button>
    </div>
  );
}

function RuleValueInput({
  rule,
  onChange,
  valueType,
}: {
  rule: SegmentRule;
  onChange: (next: SegmentRule) => void;
  valueType: "text" | "number" | "month" | "boolean";
}) {
  if (valueType === "boolean") {
    return (
      <select
        value={String(rule.value)}
        onChange={(e) =>
          onChange({ ...rule, value: e.target.value === "true" } as SegmentRule)
        }
        className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-2 py-1 text-xs font-bold"
      >
        <option value="true">Ano</option>
        <option value="false">Ne</option>
      </select>
    );
  }
  if (valueType === "month") {
    const months = [
      "leden",
      "únor",
      "březen",
      "duben",
      "květen",
      "červen",
      "červenec",
      "srpen",
      "září",
      "říjen",
      "listopad",
      "prosinec",
    ];
    return (
      <select
        value={String(rule.value || 1)}
        onChange={(e) => onChange({ ...rule, value: Number(e.target.value) } as SegmentRule)}
        className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-2 py-1 text-xs font-bold"
      >
        {months.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
    );
  }
  if (valueType === "number") {
    return (
      <input
        type="number"
        min={1}
        value={Number(rule.value || 0)}
        onChange={(e) => onChange({ ...rule, value: Number(e.target.value) } as SegmentRule)}
        className="w-24 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-2 py-1 text-xs font-bold"
      />
    );
  }
  return (
    <input
      type="text"
      value={String(rule.value ?? "")}
      placeholder={rule.field === "tag" ? "např. vip" : rule.field === "city" ? "Praha" : ""}
      onChange={(e) => onChange({ ...rule, value: e.target.value } as SegmentRule)}
      className="min-w-[140px] rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-2 py-1 text-xs font-bold"
    />
  );
}
