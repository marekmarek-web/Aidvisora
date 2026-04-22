import "server-only";

import type { ContentSourceRow } from "@/app/actions/email-content-sources";

/**
 * F6 — složí newsletter ze šablony typu `newsletter`:
 * - nahradí blok mezi `<!-- articles:start -->` a `<!-- articles:end -->`
 *   opakovaným HTML fragmentem pro každý článek,
 * - vrátí finální HTML kampaně připravený k odeslání.
 *
 * Pokud šablona nemá markery, fallback na zřetězení článků před `</div>`.
 */
export function composeNewsletterHtml(
  templateHtml: string,
  articles: Array<
    Pick<ContentSourceRow, "id" | "url" | "title" | "description" | "imageUrl" | "sourceName"> & {
      canonicalUrl?: string | null;
    }
  >,
): string {
  const articleBlocks = articles.map(renderArticleCard).join("\n");
  const startTag = "<!-- articles:start -->";
  const endTag = "<!-- articles:end -->";
  const startIdx = templateHtml.indexOf(startTag);
  const endIdx = templateHtml.indexOf(endTag);

  if (startIdx >= 0 && endIdx > startIdx) {
    return (
      templateHtml.slice(0, startIdx + startTag.length) +
      "\n" +
      articleBlocks +
      "\n" +
      templateHtml.slice(endIdx)
    );
  }

  // Fallback: inject before closing </div>
  const closingIdx = templateHtml.lastIndexOf("</div>");
  if (closingIdx > 0) {
    return templateHtml.slice(0, closingIdx) + articleBlocks + templateHtml.slice(closingIdx);
  }
  return templateHtml + articleBlocks;
}

function renderArticleCard(article: {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  sourceName: string | null;
  canonicalUrl?: string | null;
}): string {
  const href = escapeAttr(article.canonicalUrl || article.url);
  const title = escapeHtml(article.title || article.url);
  const description = article.description ? escapeHtml(article.description) : "";
  const source = article.sourceName ? escapeHtml(article.sourceName) : "";
  const img = article.imageUrl
    ? `<img src="${escapeAttr(article.imageUrl)}" alt="" style="width:100%;max-width:552px;height:auto;border-radius:8px;display:block;margin-bottom:12px;" />`
    : "";

  return `
  <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;background:#fff;">
    ${img}
    ${source ? `<p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">${source}</p>` : ""}
    <h2 style="margin:0 0 8px;font-size:16px;color:#0B3A7A;">
      <a href="${href}" style="color:#0B3A7A;text-decoration:none;">${title}</a>
    </h2>
    ${description ? `<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.5;">${description}</p>` : ""}
    <p style="margin:0;">
      <a href="${href}" style="color:#0B3A7A;font-weight:bold;text-decoration:none;">Číst dál →</a>
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
