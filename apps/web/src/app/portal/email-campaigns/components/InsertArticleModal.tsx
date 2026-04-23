"use client";

import { useEffect, useState, useTransition } from "react";
import { listContentSources, type ContentSourceRow } from "@/app/actions/email-content-sources";

type Props = {
  onClose: () => void;
  /** Callback volaný s HTML fragmentem článků k vložení do editoru. */
  onInsert: (articlesHtml: string, articleIds: string[]) => void;
};

/**
 * B4.2 — modal pro výběr článků ze zdrojů obsahu. Umožní vybrat jeden nebo
 * více článků a vrátí HTML fragment, který editor zapíše do těla e-mailu.
 *
 * Pokud má šablona markery `<!-- articles:start --> ... <!-- articles:end -->`,
 * caller je použije pro nahrazení sekce; jinak se articles prostě appendují.
 */
export default function InsertArticleModal({ onClose, onInsert }: Props) {
  const [sources, setSources] = useState<ContentSourceRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      try {
        const rows = await listContentSources();
        setSources(rows);
      } catch {
        setSources([]);
      }
    });
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleInsert = () => {
    if (!sources || selected.size === 0) return;
    const picked = sources.filter((s) => selected.has(s.id));
    const html = picked.map(renderArticleCardHtml).join("\n");
    onInsert(html, picked.map((p) => p.id));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--wp-surface-card-border)] px-5 py-3">
          <h2 className="text-base font-black text-[color:var(--wp-text)]">Vložit článek</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[color:var(--wp-text-tertiary)] hover:bg-[color:var(--wp-main-scroll-bg)]"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">
          {loading || sources === null ? (
            <p className="text-sm text-[color:var(--wp-text-tertiary)]">Načítám zdroje…</p>
          ) : sources.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-main-scroll-bg)] px-4 py-6 text-center text-sm text-[color:var(--wp-text-tertiary)]">
              Zatím nemáte žádné zdroje obsahu. Přidejte článek v sekci{" "}
              <a
                href="/portal/email-campaigns/content-sources"
                className="font-bold text-[color:var(--wp-primary)] underline"
              >
                Zdroje obsahu
              </a>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 transition ${
                    selected.has(s.id)
                      ? "border-[color:var(--wp-primary)] bg-indigo-50"
                      : "border-[color:var(--wp-surface-card-border)] bg-white hover:bg-[color:var(--wp-main-scroll-bg)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="mt-1"
                    aria-label={s.title ?? s.url}
                  />
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.imageUrl}
                      alt=""
                      className="h-16 w-24 flex-shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-16 w-24 flex-shrink-0 rounded-md bg-[color:var(--wp-main-scroll-bg)]" />
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                      {s.sourceName ?? "—"}
                    </p>
                    <p className="truncate text-sm font-black">{s.title ?? s.url}</p>
                    {s.description ? (
                      <p className="line-clamp-2 text-xs text-[color:var(--wp-text-secondary)]">
                        {s.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--wp-surface-card-border)] px-5 py-3">
          <span className="text-xs text-[color:var(--wp-text-tertiary)]">
            Vybráno: {selected.size}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-4 py-2 text-sm font-bold hover:bg-[color:var(--wp-main-scroll-bg)]"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={selected.size === 0}
              className="rounded-xl bg-[color:var(--wp-primary)] px-4 py-2 text-sm font-black text-white hover:brightness-110 disabled:opacity-50"
            >
              Vložit ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderArticleCardHtml(source: ContentSourceRow): string {
  const url = source.canonicalUrl ?? source.url;
  const title = escapeHtml(source.title ?? source.sourceName ?? url);
  const desc = source.description ? escapeHtml(source.description) : "";
  const sourceName = escapeHtml(source.sourceName ?? "");
  const img = source.imageUrl
    ? `<img src="${escapeHtml(source.imageUrl)}" alt="" style="display:block;width:100%;max-width:560px;height:auto;border-radius:12px;margin:0 0 12px;"/>`
    : "";
  return `
<table role="presentation" style="width:100%;margin:16px 0;border-collapse:collapse;">
  <tr><td style="padding:0;">
    ${img}
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">${sourceName}</div>
    <h3 style="font-family:Arial,sans-serif;font-size:18px;margin:0 0 8px;color:#0b3a7a;">
      <a href="${escapeHtml(url)}" style="color:#0b3a7a;text-decoration:none;">${title}</a>
    </h3>
    ${desc ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#334155;margin:0 0 12px;line-height:1.5;">${desc}</p>` : ""}
    <p style="margin:0 0 16px;"><a href="${escapeHtml(url)}" style="font-family:Arial,sans-serif;color:#0B3A7A;font-weight:700;text-decoration:underline;font-size:14px;">Přečíst článek →</a></p>
  </td></tr>
</table>`.trim();
}
