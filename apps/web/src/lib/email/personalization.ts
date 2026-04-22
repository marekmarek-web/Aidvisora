/**
 * Unifikovaná personalizace pro e-mailové kampaně.
 *
 * Sdíleno mezi server actions (test send, bulk send, automations, year-in-review)
 * a queue workerem. Nová oproti původnímu `personalizeHtml`:
 *  - podporuje libovolnou mapu merge fields (ne jen jmeno/cele_jmeno/unsubscribe_url),
 *  - subject je personalizován stejným průchodem jako body (dříve jen u test sendu),
 *  - respektuje HTML escaping podle toho, zda je pole v HTML body nebo v plaintext subjectu,
 *  - umí injektovat preheader (první `{preheader}` block na začátku HTML bodu).
 */

export type MergeFields = Record<string, string | number | null | undefined>;

export type PersonalizeInput = {
  firstName?: string | null;
  lastName?: string | null;
  unsubscribeUrl?: string | null;
  referralUrl?: string | null;
  extra?: MergeFields;
};

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => HTML_ESCAPE[c] ?? c);
}

function buildDefaultFields(input: PersonalizeInput): MergeFields {
  const first = (input.firstName ?? "").trim();
  const last = (input.lastName ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ") || "kliente";
  return {
    jmeno: first || full,
    cele_jmeno: full,
    unsubscribe_url: input.unsubscribeUrl ?? "",
    referral_url: input.referralUrl ?? "",
    ...input.extra,
  };
}

function replacePlaceholders(input: string, fields: MergeFields, asHtml: boolean): string {
  return input.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_full, key: string) => {
    const value = fields[key.toLowerCase()];
    if (value === undefined || value === null) return "";
    const str = String(value);
    // URL jako unsubscribe_url nesmí být html-escaped (použije se v atributu href)
    if (key.toLowerCase().endsWith("_url")) return str;
    return asHtml ? escapeHtml(str) : str;
  });
}

export function personalizeSubject(subject: string, input: PersonalizeInput): string {
  const fields = buildDefaultFields(input);
  return replacePlaceholders(subject, fields, false);
}

export function personalizeBody(html: string, input: PersonalizeInput): string {
  const fields = buildDefaultFields(input);
  return replacePlaceholders(html, fields, true);
}

/**
 * Vloží neviditelný preheader jako první element v `<body>` (nebo jako první div, pokud
 * není root <body>). Preheader se zobrazí v náhledu inboxu, ale je skrytý vizuálně.
 */
export function injectPreheader(html: string, preheader: string | null | undefined): string {
  const text = preheader?.trim();
  if (!text) return html;
  const escaped = escapeHtml(text);
  const block = `<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;" aria-hidden="true">${escaped}</div>`;

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, (_m, attrs) => `<body${attrs}>${block}`);
  }
  // HTML fragment bez <body>: přidej na začátek
  return `${block}${html}`;
}

/**
 * Kombinace subject + body personalizace + preheader + (volitelně) plain text.
 * Používá se v queue workeru a bulk sendu jako jediný touch-point pro merge fields.
 */
export function personalizeMessage(params: {
  subject: string;
  bodyHtml: string;
  preheader?: string | null;
  input: PersonalizeInput;
}): { subject: string; bodyHtml: string } {
  const subject = personalizeSubject(params.subject, params.input);
  const bodyWithPreheader = injectPreheader(params.bodyHtml, params.preheader ?? null);
  const bodyHtml = personalizeBody(bodyWithPreheader, params.input);
  return { subject, bodyHtml };
}
