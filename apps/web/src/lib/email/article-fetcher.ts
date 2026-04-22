import "server-only";

export type ArticleMetadata = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  sourceName: string | null;
  canonicalUrl: string | null;
};

const META_FETCH_TIMEOUT_MS = 8000;

/**
 * F6 — fetchne HTML cílové URL a vytáhne open-graph metadata (title, image,
 * description, canonical). Používá se pro ruční kurátování článků, které se
 * následně skládají do newsletteru.
 */
export async function fetchArticleMetadata(rawUrl: string): Promise<ArticleMetadata> {
  const url = normalizeUrl(rawUrl);
  if (!url) throw new Error("Neplatná URL.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "AidvisoraBot/1.0 (+https://aidvisora.cz)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new Error("Cílová URL nevrací HTML.");
    }
    const html = await res.text();
    return parseMetadataFromHtml(html, res.url);
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("Timeout při načítání článku.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function parseMetadataFromHtml(html: string, finalUrl: string): ArticleMetadata {
  const head = html.slice(0, 120_000);

  const title =
    extractMeta(head, /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    extractMeta(head, /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i) ||
    extractMeta(head, /<title[^>]*>([^<]+)<\/title>/i);

  const description =
    extractMeta(head, /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
    extractMeta(head, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);

  const imageRaw =
    extractMeta(head, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    extractMeta(head, /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  const imageUrl = imageRaw ? resolveUrl(imageRaw, finalUrl) : null;

  const canonicalRaw =
    extractMeta(head, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) ||
    extractMeta(head, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
  const canonicalUrl = canonicalRaw ? resolveUrl(canonicalRaw, finalUrl) : finalUrl;

  const sourceName =
    extractMeta(head, /<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i) ||
    new URL(finalUrl).hostname.replace(/^www\./, "");

  return {
    title: decodeHtmlEntities(title),
    description: decodeHtmlEntities(description),
    imageUrl,
    sourceName,
    canonicalUrl,
  };
}

function extractMeta(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1]!.trim() : null;
}

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(s: string | null): string | null {
  if (!s) return null;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .trim();
}
