/**
 * RFC 8058 One-Click + RFC 2369 List-Unsubscribe headers.
 *
 * Gmail / Apple Mail / Outlook.com respektují tyto headery a ukazují nativní
 * „Odhlásit odběr" tlačítko v UI.  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
 * zapne One-Click flow, kdy klient odešle POST na unsubscribe URL bez další
 * interakce.
 *
 * Naše `/client/unsubscribe?token=...` handluje jak GET (stránka s tlačítkem)
 * tak POST (One-Click) — viz `apps/web/src/app/client/unsubscribe/` +
 * `apps/web/src/app/actions/unsubscribe.ts`.
 */
export function buildListUnsubscribeHeaders(params: {
  /** Odkaz na stránku pro odhlášení (token-based, např. /client/unsubscribe?token=XXX). */
  unsubscribeUrl: string | null;
  /**
   * Odkaz pro One-Click POST (RFC 8058) — pokud není vyplněn, derivujeme ho
   * z `unsubscribeUrl` výměnou cesty za `/api/unsubscribe/one-click?token=...`.
   */
  oneClickUrl?: string | null;
  mailto?: string | null;
}): Record<string, string> {
  const { unsubscribeUrl, mailto } = params;
  if (!unsubscribeUrl && !mailto) return {};

  const parts: string[] = [];
  if (unsubscribeUrl) parts.push(`<${unsubscribeUrl}>`);
  const oneClick = params.oneClickUrl ?? deriveOneClickUrl(unsubscribeUrl);
  if (oneClick && oneClick !== unsubscribeUrl) {
    parts.push(`<${oneClick}>`);
  }
  if (mailto) parts.push(`<mailto:${mailto}>`);

  const headers: Record<string, string> = {
    "List-Unsubscribe": parts.join(", "),
  };
  if (unsubscribeUrl || oneClick) {
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return headers;
}

function deriveOneClickUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    if (!token) return null;
    return `${parsed.origin}/api/unsubscribe/one-click?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}
