import type { Column } from "@/app/components/monday/types";
import { BLANK_BOARD_COLUMNS, DEFAULT_BOARD_COLUMNS } from "@/app/board/seed-data";

const COLUMN_TEMPLATE_BY_ID = new Map(DEFAULT_BOARD_COLUMNS.map((c) => [c.id, c]));

/** Sloupce z DB jsou zdroj pravdy; u známých id doplníme výchozí metadata ze šablony. */
export function resolveBoardColumns(saved: Column[]): Column[] {
  if (!saved?.length) return BLANK_BOARD_COLUMNS.map((c) => ({ ...c }));
  return saved.map((s) => {
    const template = COLUMN_TEMPLATE_BY_ID.get(s.id);
    return template ? ({ ...template, ...s } as Column) : s;
  });
}
