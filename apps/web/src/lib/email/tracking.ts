/**
 * Tracking helpers pro e-mailové kampaně.
 *
 * Klíčové rozhodnutí: click tracking pracuje s **per-recipient opaque tokenem**
 * (`email_campaign_recipients.tracking_token`) a cílovou URL posíláme jako
 * **base64url query parameter** `u`. HMAC nad tokenem+URL v URL NEPOUŽÍVÁME —
 * proto v `/api/t/c/[token]` musí být **whitelist redirect ochrana** (viz route).
 *
 * Open pixel: `/api/t/o/[token].gif` — 1×1 transparentní GIF, ignoruje cache.
 */

export function encodeTargetUrl(url: string): string {
  // base64url (bez padding)
  const base64 = Buffer.from(url, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeTargetUrl(encoded: string): string | null {
  try {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function buildClickUrl(baseUrl: string, token: string, targetUrl: string): string {
  const u = encodeTargetUrl(targetUrl);
  return `${baseUrl.replace(/\/$/, "")}/api/t/c/${token}?u=${u}`;
}

export function buildOpenPixelUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/t/o/${token}.gif`;
}

/**
 * Přepíše všechny `<a href="...">` na tracking proxy. Nebere v úvahu
 * `{{unsubscribe_url}}` (už je přeloženo), ani mailto:/tel: schemes.
 *
 * Jednoduchý regex místo DOM parseru — HTML emailů je často fragmentární
 * a full parser (např. `htmlparser2`) by zvýšil cold start.
 */
export function rewriteHtmlForTracking(
  html: string,
  opts: { token: string | null; baseUrl: string },
): string {
  if (!opts.token) return html;
  const { token, baseUrl } = opts;

  return html.replace(/<a\b([^>]*?)href\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (match, pre, quote, url, post) => {
    const trimmed = (url as string).trim();
    if (!trimmed) return match;
    // skip mailto/tel/anchor/javascript
    if (/^(mailto:|tel:|javascript:|#)/i.test(trimmed)) return match;
    // skip unsubscribe (uživatel musí klikat přímo)
    if (trimmed.includes("/client/unsubscribe")) return match;
    // skip already-tracked
    if (trimmed.includes("/api/t/c/")) return match;
    // only http(s)
    if (!/^https?:\/\//i.test(trimmed)) return match;

    const tracked = buildClickUrl(baseUrl, token, trimmed);
    return `<a${pre}href=${quote}${tracked}${quote}${post}>`;
  });
}

/** Injektuje open pixel jako poslední element v `<body>` (nebo na konec HTML). */
export function injectOpenPixel(
  html: string,
  opts: { token: string | null; baseUrl: string },
): string {
  if (!opts.token) return html;
  const pixelSrc = buildOpenPixelUrl(opts.baseUrl, opts.token);
  const pixel = `<img src="${pixelSrc}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;overflow:hidden;border:0;" />`;

  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${pixel}</body>`);
  }
  return `${html}${pixel}`;
}

/** Whitelist redirect: povolíme pouze http(s) URL. Žádné `javascript:`, data:, atd. */
export function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
