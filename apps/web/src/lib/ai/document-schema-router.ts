import type { PrimaryDocumentType } from "./document-review-types";
import { DOCUMENT_SCHEMA_REGISTRY, type DocumentSchemaDefinition } from "./document-schema-registry";

export function resolveDocumentSchema(primaryType: PrimaryDocumentType): DocumentSchemaDefinition {
  return DOCUMENT_SCHEMA_REGISTRY[primaryType] ?? DOCUMENT_SCHEMA_REGISTRY.unsupported_or_unknown;
}

