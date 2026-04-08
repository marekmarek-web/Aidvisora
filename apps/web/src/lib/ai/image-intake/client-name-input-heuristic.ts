/**
 * Heuristika: vypadá zpráva jako pokus o jméno klienta (resume image intake),
 * ne jako obecný dotaz nebo UI instrukce?
 */
export function looksLikeClientNameInput(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 80) return false;
  const lower = t.toLowerCase();
  if (lower.includes("?") || lower.includes("vytvoř") || lower.includes("přidej") || lower.includes("smaž")) return false;
  if (
    (lower.includes("sdělte") && lower.includes("jméno")) ||
    lower.includes("textovém poli") ||
    lower.includes("nahrajte obrázek") ||
    lower.includes("otevřete kartu")
  ) {
    return false;
  }
  return true;
}
