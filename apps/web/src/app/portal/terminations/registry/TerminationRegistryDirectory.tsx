"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TerminationInsurerRegistryDirectoryRow } from "@/app/actions/terminations";
import { terminationDeliveryChannelLabel } from "@/lib/terminations/client";

type Props = {
  rows: TerminationInsurerRegistryDirectoryRow[];
};

export function TerminationRegistryDirectory({ rows }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.insurerName.toLowerCase().includes(s) ||
        r.catalogKey.toLowerCase().includes(s) ||
        (r.addressLine?.toLowerCase().includes(s) ?? false) ||
        (r.officialFormNotes?.toLowerCase().includes(s) ?? false),
    );
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="reg-filter" className="mb-2 block text-xs font-medium text-[color:var(--wp-text-muted)]">
          Hledat v názvu, kódu, adrese nebo poznámce
        </label>
        <input
          id="reg-filter"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="např. Kooperativa, Brno, online…"
          className="h-12 w-full max-w-md rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] px-4 text-sm min-h-[44px]"
        />
        <p className="mt-2 text-xs text-[color:var(--wp-text-secondary)]">
          Zobrazeno {filtered.length} z {rows.length} záznamů (globální registr + případné úpravy pro váš tenant).
        </p>
      </div>

      <ul className="space-y-4">
        {filtered.map((r) => (
          <li
            key={r.id}
            className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-4 space-y-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--wp-text)]">{r.insurerName}</h2>
                <p className="text-xs font-mono text-[color:var(--wp-text-muted)]">{r.catalogKey}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.requiresOfficialForm ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950 border border-amber-200">
                    Preferuje formulář / portál
                  </span>
                ) : null}
                {r.freeformLetterAllowed ? (
                  <span className="rounded-full bg-[color:var(--wp-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--wp-text-secondary)] border border-[color:var(--wp-border)]">
                    Volný dopis možný
                  </span>
                ) : null}
              </div>
            </div>

            {r.addressLine ? (
              <p className="text-sm text-[color:var(--wp-text)]">
                <span className="font-medium text-[color:var(--wp-text-muted)]">Adresa pro dokumenty: </span>
                {r.addressLine}
              </p>
            ) : (
              <p className="text-sm text-[color:var(--wp-text-secondary)]">Adresa v registru není vyplněná.</p>
            )}

            {r.allowedChannels?.length ? (
              <p className="text-sm text-[color:var(--wp-text)]">
                <span className="font-medium text-[color:var(--wp-text-muted)]">Kanály: </span>
                {r.allowedChannels.map((ch) => terminationDeliveryChannelLabel(ch)).join(" · ")}
              </p>
            ) : null}

            {r.email ? (
              <p className="text-sm">
                <span className="font-medium text-[color:var(--wp-text-muted)]">E-mail: </span>
                <a className="text-[var(--wp-accent)] underline" href={`mailto:${r.email}`}>
                  {r.email}
                </a>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3 text-sm">
              {r.webFormUrl ? (
                <a
                  href={r.webFormUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--wp-accent)] underline"
                >
                  Web pojišťovny
                </a>
              ) : null}
              {r.clientPortalUrl ? (
                <a
                  href={r.clientPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--wp-accent)] underline"
                >
                  Klientská zóna
                </a>
              ) : null}
            </div>

            {r.officialFormNotes ? (
              <p className="text-xs leading-relaxed text-[color:var(--wp-text-secondary)] border-t border-[color:var(--wp-border)] pt-2 mt-1">
                {r.officialFormNotes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="text-sm text-[color:var(--wp-text-secondary)]">Žádná shoda — zkuste jiný výraz.</p>
      ) : null}

      <p className="text-xs text-[color:var(--wp-text-muted)]">
        Zdroj dat: interní registr (viz také{" "}
        <Link href="/portal/terminations/new" className="text-[var(--wp-accent)] underline">
          průvodce výpovědí
        </Link>
        ). Úplnost adres ověřte vůči aktuálním podmínkám pojišťovny.
      </p>
    </div>
  );
}
