"use client";

import { useState } from "react";
import { exportContactDataForClient } from "@/app/actions/gdpr";

export function ClientZoneExportButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const data = await exportContactDataForClient();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-dat-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // B2.7: dříve tichý fail (finally jen reset loading). Klient klikl a nic
      // se nestalo — to je nepřijatelné pro GDPR export právo. Zobrazíme chybu.
      const msg = e instanceof Error ? e.message : "Export se nezdařil. Zkuste to prosím znovu.";
      setError(msg);
      // eslint-disable-next-line no-console
      console.error("[ClientZoneExportButton] export failed", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg px-4 min-h-[44px] inline-flex items-center justify-center text-sm font-semibold border border-monday-border text-monday-text hover:bg-monday-row-hover disabled:opacity-50"
      >
        {loading ? "Připravuji…" : "Export mých dat (GDPR)"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-700 font-medium max-w-[260px]">
          {error}
        </p>
      )}
    </div>
  );
}
