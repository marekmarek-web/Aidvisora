import { SEGMENT_LABELS as _LABELS } from "db";

export const SEGMENT_LABELS = _LABELS;

export function segmentLabel(code: string): string {
  return SEGMENT_LABELS[code] ?? code;
}
