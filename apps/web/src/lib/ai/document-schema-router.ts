import type { PrimaryDocumentType } from "./document-review-types";
import { DOCUMENT_SCHEMA_REGISTRY, type DocumentSchemaDefinition } from "./document-schema-registry";

export function resolveDocumentSchema(primaryType: PrimaryDocumentType): DocumentSchemaDefinition {
  return DOCUMENT_SCHEMA_REGISTRY[primaryType] ?? DOCUMENT_SCHEMA_REGISTRY.unsupported_or_unknown;
}

/** Explicit schema selection for telemetry/tests (Plan 3 §4.6). */
export function selectSchemaForType(primaryType: PrimaryDocumentType): DocumentSchemaDefinition {
  return resolveDocumentSchema(primaryType);
}

