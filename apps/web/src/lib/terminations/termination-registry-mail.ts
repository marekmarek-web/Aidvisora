/** Jednořádkové zobrazení mailing_address JSON z insurer_termination_registry. */
export function formatTerminationRegistryMailingOneLine(m: Record<string, unknown> | null | undefined): string | null {
  if (!m || typeof m !== "object") return null;
  const dept = typeof m.department === "string" ? m.department.trim() : "";
  const street = typeof m.street === "string" ? m.street : "";
  const city = typeof m.city === "string" ? m.city : "";
  const zip = typeof m.zip === "string" ? m.zip : "";
  const tail = [zip, city].filter(Boolean).join(" ");
  const core = [street, tail].filter(Boolean).join(", ").trim();
  const line = dept && core ? `${dept}, ${core}` : dept || core;
  return line.trim() || null;
}
