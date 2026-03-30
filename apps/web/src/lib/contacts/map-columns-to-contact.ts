import type { ColumnMapping, ContactRowInput } from "@/lib/contacts/import-types";
import { parseLifecycleStage, parseTagsFromCell } from "./import-parsers";

export function mapColumnsToContact(cols: string[], mapping: ColumnMapping): ContactRowInput {
  const cell = (idx: number | null) => {
    if (idx === null) return "";
    return (cols[idx] ?? "").trim();
  };
  const firstName = cell(mapping.firstName);
  const lastName = cell(mapping.lastName);
  const email = cell(mapping.email) || undefined;
  const phone = cell(mapping.phone) || undefined;
  const lifecycleRaw = cell(mapping.lifecycleStage);
  const lifecycleStage =
    mapping.lifecycleStage !== null && lifecycleRaw ? parseLifecycleStage(lifecycleRaw) : null;
  const tagsRaw = cell(mapping.tags);
  const tags = mapping.tags !== null && tagsRaw ? parseTagsFromCell(tagsRaw) : null;
  const notesRaw = cell(mapping.notes);
  const notes = mapping.notes !== null && notesRaw ? notesRaw : null;
  return { firstName, lastName, email, phone, lifecycleStage, tags, notes };
}
