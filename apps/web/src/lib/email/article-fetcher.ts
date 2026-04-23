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
 * Whitelist důvěryhodných domén pro ruční kurátování článků.
 *
 * Přidání další domény si žádá explicitní review — nesnažíme se podporovat
 * libovolnou URL, protože server-side fetch nedůvěryhodných URL je SSRF vector.
 * Match: `host === domain` nebo `host.endsWith('.' + domain)`.
 */
export const ARTICLE_FETCHER_ALLOWED_DOMAINS: readonly string[] = [
  "kurzy.cz",
  "penize.cz",
  "hypoindex.cz",
  "idnes.cz",
  "aktualne.cz",
  "e15.cz",
  "seznamzpravy.cz",
  "novinky.cz",
  "roklen24.cz",
  "cnb.cz",
  "mfcr.cz",
  "ceskenoviny.cz",
  "mesec.cz",
  "finance.cz",
  "investujeme.cz",
];

export function isDomainAllowed(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return ARTICLE_FETCHER_ALLOWED_DOMAINS.some(
    (d) => h === d || h.endsWith(`.${d}`),
  );
}

/** Odmítne privátní, loopback a link-local adresy (IPv4 + IPv6) pro SSRF guard. */
export function isPrivateOrInvalidHost(host: string): boolean {
  const h = host.toLowerCase();
  if (!h) return true;
  if (h === "localhost") return true;
  // IPv6 loopback / link-local / ULA
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
    return true;
  }
  // IPv4 dotted quad
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast + reserved
  }
  return false;
}

/**
 * F6 — fetchne HTML cílové URL a vytáhne open-graph metadata (title, image,
 * description, canonical). Používá se pro ruční kurátování článků, které se
 * následně skládají do newsletteru.
 *
 * Bezpečnost:
 *  - Povolené jsou pouze domény v `ARTICLE_FETCHER_ALLOWED_DOMAINS`.
 *  - Privátní/loopback/link-local hosty jsou odmítnuty (SSRF guard).
 *  - Redirect je povolen, ale finální URL musí stále splňovat whitelist
 *    (ověřeno po fetchi skrz `res.url`).
 */
export async function fetchArticleMetadata(rawUrl: string): Promise<ArticleMetadata> {
  const url = normalizeUrl(rawUrl);
  if (!url) throw new Error("Neplatná URL.");

  const parsed = new URL(url);
  if (isPrivateOrInvalidHost(parsed.hostname)) {
    throw new Error("Privátní nebo neplatná adresa není povolena.");
  }
  if (!isDomainAllowed(parsed.hostname)) {
    throw new Error(
      `Doména '${parsed.hostname}' není ve whitelistu. Povolené jsou důvěryhodné zpravodajské portály.`,
    );
  }

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
    // Re-verify final URL after redirects — never trust first-hop validation.
    try {
      const finalHost = new URL(res.url).hostname;
      if (isPrivateOrInvalidHost(finalHost) || !isDomainAllowed(finalHost)) {
        throw new Error(
          `Redirect mimo whitelist (${finalHost}); odmítnuto.`,
        );
      }
    } catch (urlErr) {
      if (urlErr instanceof Error && urlErr.message.startsWith("Redirect")) throw urlErr;
      throw new Error("Neplatná finální URL po redirectu.");
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
