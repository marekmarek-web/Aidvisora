import { describe, expect, it } from "vitest";
import { runBacktest } from "../investment.backtest";
import type { HistoricalDataPoint } from "../investment.config";

const MINIMAL_HISTORY: HistoricalDataPoint[] = [
  { date: "2020-01-01", sp500: 100, gold: 50, bonds: 100, re: 80 },
  { date: "2020-02-01", sp500: 110, gold: 52, bonds: 101, re: 82 },
  { date: "2020-03-01", sp500: 105, gold: 55, bonds: 102, re: 81 },
];

describe("runBacktest", () => {
  it("accumulates invested series and asset valuations from startYear", () => {
    const r = runBacktest(100, 2020, MINIMAL_HISTORY);
    expect(r.invested.length).toBeGreaterThanOrEqual(3);
    expect(r.sp500.length).toBe(r.invested.length);
    const lastInvested = r.invested[r.invested.length - 1][1];
    expect(lastInvested).toBeGreaterThan(0);
    const lastSp = r.sp500[r.sp500.length - 1][1];
    expect(lastSp).toBeGreaterThan(0);
  });

  it("uses first data point when startYear is before series", () => {
    const r = runBacktest(50, 1990, MINIMAL_HISTORY);
    expect(r.invested.length).toBeGreaterThanOrEqual(1);
  });
});
