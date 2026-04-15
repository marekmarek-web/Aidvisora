import { describe, expect, it } from "vitest";
import {
  boardUnitsToPixels,
  BOARD_UNIT_MAX,
  BOARD_UNIT_MIN,
  clampBoardUnit,
  pixelsToBoardUnits,
} from "../notes-board-units";

describe("notes-board-units", () => {
  it("clampBoardUnit keeps values in [0, 1]", () => {
    expect(clampBoardUnit(-1)).toBe(BOARD_UNIT_MIN);
    expect(clampBoardUnit(2)).toBe(BOARD_UNIT_MAX);
    expect(clampBoardUnit(0.5)).toBe(0.5);
    expect(clampBoardUnit(Number.NaN)).toBe(BOARD_UNIT_MIN);
  });

  it("pixelsToBoardUnits matches fraction of axis", () => {
    expect(pixelsToBoardUnits(100, 400)).toBe(0.25);
    expect(pixelsToBoardUnits(400, 400)).toBe(BOARD_UNIT_MAX);
    expect(pixelsToBoardUnits(0, 0)).toBe(BOARD_UNIT_MIN);
  });

  it("boardUnitsToPixels round-trips with pixelsToBoardUnits for stable axis", () => {
    const w = 1440;
    const px = 360;
    const u = pixelsToBoardUnits(px, w);
    expect(boardUnitsToPixels(u, w)).toBeCloseTo(px, 8);
  });
});
