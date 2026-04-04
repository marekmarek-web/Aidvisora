/**
 * Section-specific extraction prompt builders for per-subdocument routing.
 *
 * These prompts are targeted at SPECIFIC sections within a bundle document.
 * They are used by the subdocument extraction orchestrator when a multi-section
 * bundle is detected. Each prompt focuses on extracting data for ONE type of
 * subdocument only — ignoring the rest of the document.
 *
 * Design:
 * - Hardcoded prompts (not Prompt Builder IDs) — no env config required.
 * - Small focused JSON schemas — minimal token footprint.
 * - Called only when the corresponding section is detected with confidence >= 0.4.
 */

import type { PacketSubdocumentCandidate } from "./document-packet-types";

// ─── Health Questionnaire ─────────────────────────────────────────────────────

export const HEALTH_SECTION_EXTRACTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["healthSectionPresent", "questionnaireEntries"],
  properties: {
    healthSectionPresent: { type: "boolean" },
    questionnaireEntries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["questionnairePresent"],
        properties: {
          participantName: { type: "string" },
          participantRole: { type: "string" },
          questionnairePresent: { type: "boolean" },
          sectionSummary: { type: "string" },
          medicallyRelevantFlags: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

export type HealthSectionExtractionOutput = {
  healthSectionPresent: boolean;
  questionnaireEntries: Array<{
    participantName?: string;
    participantRole?: string;
    questionnairePresent: boolean;
    sectionSummary?: string;
    medicallyRelevantFlags?: string[];
  }>;
};

/**
 * Build a focused prompt for extracting health questionnaire data from a document.
 * The LLM is explicitly told to ONLY extract health questionnaire sections.
 */
export function buildHealthSectionExtractionPrompt(
  documentText: string,
  candidates: PacketSubdocumentCandidate[],
): string {
  const hintLines = candidates
    .filter((c) => c.type === "health_questionnaire" || c.type === "aml_fatca_form")
    .map((c) => `- ${c.label}${c.sectionHeadingHint ? `: "${c.sectionHeadingHint}"` : ""}`)
    .join("\n");

  const trimmedText = documentText.trim();
  return `Jsi extrakční systém pro zdravotní dotazníky ve finančních dokumentech.

Tvůj úkol: Identifikuj a extrahuj POUZE zdravotní dotazníky nebo zdravotní prohlášení.
Ignoruj smlouvu, investiční sekci, AML formuláře a platební instrukce.

${hintLines ? `Detekované sekce v dokumentu:\n${hintLines}\n` : ""}

Pro každou nalezenou osobu v zdravotní sekci vyplň:
- participantName: celé jméno osoby (nebo prázdný string, pokud není uvedeno)
- participantRole: role osoby (pojistník / pojištěný / dítě / jiný)
- questionnairePresent: true pokud je zdravotní dotazník pro tuto osobu přítomný
- sectionSummary: stručný popis (1–2 věty) co sekce obsahuje, bez zdravotních detailů
- medicallyRelevantFlags: obecné příznaky důležité pro upisování (max 5 položek), NIK DY konkrétní diagnózy

Pokud zdravotní sekce není přítomna, vrať healthSectionPresent: false a prázdné pole.
Vrátíš pouze JSON dle schema. Žádný markdown, žádný komentář.

TEXT DOKUMENTU:
<<<DOCUMENT_TEXT>>>
${trimmedText}
<<<END_DOCUMENT_TEXT>>>`;
}

// ─── AML / FATCA ─────────────────────────────────────────────────────────────

export const AML_SECTION_EXTRACTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["amlSectionPresent", "declarationPresent", "complianceFlags"],
  properties: {
    amlSectionPresent: { type: "boolean" },
    declarationPresent: { type: "boolean" },
    politicallyExposedPerson: { type: ["boolean", "null"] },
    complianceFlags: {
      type: "array",
      items: { type: "string" },
    },
    participantName: { type: "string" },
  },
};

export type AmlSectionExtractionOutput = {
  amlSectionPresent: boolean;
  declarationPresent: boolean;
  politicallyExposedPerson?: boolean | null;
  complianceFlags: string[];
  participantName?: string;
};

/**
 * Build a focused prompt for extracting AML/FATCA compliance data.
 */
export function buildAmlSectionExtractionPrompt(documentText: string): string {
  const trimmedText = documentText.trim();
  return `Jsi extrakční systém pro AML/FATCA formuláře ve finančních dokumentech.

Tvůj úkol: Identifikuj a extrahuj POUZE AML (Anti-Money Laundering) nebo FATCA sekce.
Ignoruj smlouvu, zdravotní dotazníky a platební instrukce.

Extrahuj:
- amlSectionPresent: true pokud je AML/FATCA sekce přítomna
- declarationPresent: true pokud obsahuje prohlášení o původu prostředků
- politicallyExposedPerson: true/false/null dle obsahu (null pokud neuveden)
- complianceFlags: seznam relevantních compliance příznaků (max 5)
- participantName: jméno deklarující osoby, pokud je uvedeno

Vrátíš pouze JSON dle schema. Žádný markdown, žádný komentář.

TEXT DOKUMENTU:
<<<DOCUMENT_TEXT>>>
${trimmedText}
<<<END_DOCUMENT_TEXT>>>`;
}

// ─── Contract section (for bundle type correction) ────────────────────────────

/**
 * Build a section-aware extraction prompt that tells the LLM about detected
 * bundle sections. Used as an AUGMENTATION of the combined extraction prompt
 * when a bundle is detected — adds explicit section context at the top.
 */
export function buildBundleAwareExtractionHint(
  candidates: PacketSubdocumentCandidate[],
): string {
  if (candidates.length === 0) return "";

  const sectionLines = candidates
    .map(
      (c, i) =>
        `  ${i + 1}. ${c.label} (typ: ${c.type}, publishovatelný: ${c.publishable ? "ANO" : "NE"}${c.pageRangeHint ? `, strany: ${c.pageRangeHint}` : ""})`,
    )
    .join("\n");

  return `UPOZORNĚNÍ: Dokument je bundle (více logických sekcí):
${sectionLines}

Při extrakci:
- Extrahuj contract fields Z finální smlouvy nebo návrhu smlouvy, ne ze zdravotního dotazníku nebo AML.
- Nepublikuj zdravotní dotazníky ani AML/FATCA jako smlouvu.
- Nastav contentFlags.containsMultipleDocumentSections = true.
- Životní cyklus (lifecycleStatus) urči podle PRIMÁRNÍ sekce (finální smlouva > návrh > modelace).`;
}
