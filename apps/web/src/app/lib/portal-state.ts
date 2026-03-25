/**
 * Portal board state persistence (demo). Legacy keys: weplan_portal_state_v1 / v2.
 */

import type { Board, Column } from "@/app/components/monday/types";
import { DEFAULT_BOARD_COLUMNS } from "@/app/board/seed-data";
const STORAGE_KEY = "aidvisora_portal_state_v2";

function migratePortalStorageKeys(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(STORAGE_KEY) != null) return;
  const v2 = localStorage.getItem("weplan_portal_state_v2");
  if (v2 != null) {
    localStorage.setItem(STORAGE_KEY, v2);
    localStorage.removeItem("weplan_portal_state_v2");
    return;
  }
  const v1 = localStorage.getItem("weplan_portal_state_v1");
  if (v1 != null) {
    localStorage.setItem(STORAGE_KEY, v1);
    localStorage.removeItem("weplan_portal_state_v1");
  }
}

function mergeColumnsWithDefaults(saved: Column[]): Column[] {
  const byId = new Map(saved.map((c) => [c.id, c]));
  return DEFAULT_BOARD_COLUMNS.map((def) => (byId.has(def.id) ? { ...def, ...byId.get(def.id) } : { ...def }));
}

export type PortalState = {
  board: Board;
  hiddenColumnIds: string[];
  activeViewId: string;
};

export function loadPortalState(fallbackBoard: Board): PortalState {
  if (typeof window === "undefined") {
    return {
      board: fallbackBoard,
      hiddenColumnIds: [],
      activeViewId: fallbackBoard.views[0]?.id ?? "v1",
    };
  }
  migratePortalStorageKeys();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { board: fallbackBoard, hiddenColumnIds: [], activeViewId: fallbackBoard.views[0]?.id ?? "v1" };
    const parsed = JSON.parse(raw) as PortalState;
    if (!parsed?.board?.views?.length || !Array.isArray(parsed.board.groups) || typeof parsed.board.items !== "object") {
      return { board: fallbackBoard, hiddenColumnIds: [], activeViewId: fallbackBoard.views[0]?.id ?? "v1" };
    }
    const board: Board = {
      ...parsed.board,
      views: parsed.board.views.map((v) => ({
        ...v,
        columns: mergeColumnsWithDefaults(Array.isArray(v.columns) ? v.columns : []),
      })),
    };
    return {
      board,
      hiddenColumnIds: Array.isArray(parsed.hiddenColumnIds) ? parsed.hiddenColumnIds : [],
      activeViewId: typeof parsed.activeViewId === "string" && parsed.board.views.some((v: { id: string }) => v.id === parsed.activeViewId)
        ? parsed.activeViewId
        : parsed.board.views[0]?.id ?? "v1",
    };
  } catch {
    return { board: fallbackBoard, hiddenColumnIds: [], activeViewId: fallbackBoard.views[0]?.id ?? "v1" };
  }
}

export function savePortalState(state: PortalState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
