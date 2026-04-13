/**
 * Jednoduchý HTML náhled dopisu (escaping + zachování odstavců).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Převede prostý text na HTML s odstavci podle prázdných řádků. */
export function plainTextToLetterHtml(plain: string): string {
  const blocks = plain.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const inner = blocks.map((b) => `<p>${escapeHtml(b).replace(/\n/g, "<br/>")}</p>`).join("\n");
  return `<div class="termination-letter-html">${inner}</div>`;
}

/**
 * Kompletní HTML dokument pro tisk / PDF z prohlížeče.
 * Explicitní pt + @page A4 – bez toho Chrome často špatně škáluje náhled (drobné písmo v rohu).
 */
export function wrapTerminationLetterForPrint(innerHtml: string, documentTitle = "Výpověď – tisk"): string {
  const safeTitle = escapeHtml(documentTitle);
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${safeTitle}</title>
<style>
  @page { size: A4; margin: 18mm; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    background: #fff;
  }
  .termination-letter-html p {
    margin: 0 0 0.85em;
  }
  .termination-letter-html p:last-child {
    margin-bottom: 0;
  }
</style>
</head>
<body>${innerHtml}</body>
</html>`;
}

/** Otevře nové okno s dopisem a spustí tisk; zavře okno po dokončení tisku. */
export function openTerminationLetterPrintWindow(innerHtml: string, documentTitle?: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(wrapTerminationLetterForPrint(innerHtml, documentTitle));
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    const closeOnce = () => {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    };
    w.addEventListener("afterprint", closeOnce, { once: true });
    setTimeout(closeOnce, 2500);
  }, 0);
}
