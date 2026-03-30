"use client";

import type { ColumnMapping } from "@/lib/contacts/import-types";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import { User, Mail, Phone, Tag, FileText, Flag } from "lucide-react";

type Variant = "dashboard" | "drawer";

export function ImportColumnMappingBlock({
  headers,
  mapping,
  onMappingChange,
  sheetNames,
  activeSheet,
  onActiveSheetChange,
  variant = "dashboard",
}: {
  headers: string[];
  mapping: ColumnMapping;
  onMappingChange: (updater: ColumnMapping | ((prev: ColumnMapping) => ColumnMapping)) => void;
  sheetNames?: string[];
  activeSheet?: string;
  onActiveSheetChange?: (sheet: string) => void;
  variant?: Variant;
}) {
  const colOptions = headers.map((h, i) => ({ value: i, label: `${i}: ${h || "(prázdný)"}` }));
  const withSkip = (opts: { value: number; label: string }[]) => [
    { id: "", label: "— neimportovat —" },
    ...opts.map((o) => ({ id: String(o.value), label: o.label })),
  ];
  const requiredOpts = colOptions.map((o) => ({ id: String(o.value), label: o.label }));

  const labelClass =
    variant === "drawer"
      ? "text-xs font-medium text-[color:var(--wp-text-secondary)]"
      : "text-sm font-medium text-[color:var(--wp-text)]";
  const gridClass = variant === "drawer" ? "grid grid-cols-2 gap-2 mb-3" : "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-w-xl";

  return (
    <div>
      {sheetNames && sheetNames.length > 1 && activeSheet && onActiveSheetChange && (
        <div className={variant === "drawer" ? "mb-3" : "mb-4"}>
          <label className={`${labelClass} block mb-1`}>List Excelu</label>
          <CustomDropdown
            value={activeSheet}
            onChange={(id) => onActiveSheetChange(id)}
            options={sheetNames.map((n) => ({ id: n, label: n }))}
            placeholder="Vyberte list"
          />
          <p className="text-xs text-[color:var(--wp-text-muted)] mt-1">
            Ve výchozím stavu se bere první list; u více listů vyberte správný.
          </p>
        </div>
      )}

      <div className={gridClass}>
        <label className={labelClass}>Jméno</label>
        <CustomDropdown
          value={String(mapping.firstName)}
          onChange={(id) => onMappingChange((m) => ({ ...m, firstName: Number(id) }))}
          options={requiredOpts.map((o) => ({ id: o.id, label: o.label }))}
          placeholder="Sloupec"
          icon={User}
        />
        <label className={labelClass}>Příjmení</label>
        <CustomDropdown
          value={String(mapping.lastName)}
          onChange={(id) => onMappingChange((m) => ({ ...m, lastName: Number(id) }))}
          options={requiredOpts.map((o) => ({ id: o.id, label: o.label }))}
          placeholder="Sloupec"
          icon={User}
        />
        <label className={labelClass}>E-mail</label>
        <CustomDropdown
          value={String(mapping.email)}
          onChange={(id) => onMappingChange((m) => ({ ...m, email: Number(id) }))}
          options={requiredOpts.map((o) => ({ id: o.id, label: o.label }))}
          placeholder="Sloupec"
          icon={Mail}
        />
        <label className={labelClass}>Telefon</label>
        <CustomDropdown
          value={String(mapping.phone)}
          onChange={(id) => onMappingChange((m) => ({ ...m, phone: Number(id) }))}
          options={requiredOpts.map((o) => ({ id: o.id, label: o.label }))}
          placeholder="Sloupec"
          icon={Phone}
        />
        <label className={labelClass}>Fáze (stav)</label>
        <CustomDropdown
          value={mapping.lifecycleStage === null ? "" : String(mapping.lifecycleStage)}
          onChange={(id) =>
            onMappingChange((m) => ({ ...m, lifecycleStage: id === "" ? null : Number(id) }))
          }
          options={withSkip(colOptions)}
          placeholder="Volitelné"
          icon={Flag}
        />
        <label className={labelClass}>Štítky</label>
        <CustomDropdown
          value={mapping.tags === null ? "" : String(mapping.tags)}
          onChange={(id) => onMappingChange((m) => ({ ...m, tags: id === "" ? null : Number(id) }))}
          options={withSkip(colOptions)}
          placeholder="Volitelné"
          icon={Tag}
        />
        <label className={labelClass}>Poznámka</label>
        <CustomDropdown
          value={mapping.notes === null ? "" : String(mapping.notes)}
          onChange={(id) => onMappingChange((m) => ({ ...m, notes: id === "" ? null : Number(id) }))}
          options={withSkip(colOptions)}
          placeholder="Volitelné"
          icon={FileText}
        />
      </div>
      <p className="text-xs text-[color:var(--wp-text-muted)] mb-2">
        Fáze: hodnoty <code className="text-[11px]">lead</code>, <code className="text-[11px]">prospect</code>,{" "}
        <code className="text-[11px]">client</code>, <code className="text-[11px]">former_client</code> nebo česky Klient / Bývalý klient.
        Štítky oddělte středníkem nebo čárkou (např. <code className="text-[11px]">VIP; rodina</code>).
      </p>
    </div>
  );
}
