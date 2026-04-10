/** Unicode / symbol map — stejné jako v design preview, bez závislosti na mock datech. */
export const TEAM_OVERVIEW_ICONS: Record<string, string> = {
  question: "؟",
  refresh: "↻",
  warning: "⚠",
  success: "✓",
  trend: "↗",
  spark: "✧",
  pool: "◍",
  learn: "▤",
  blocker: "⟁",
  support: "✚",
  users: "👥",
  target: "◎",
  map: "▦",
  calendar: "◷",
  detail: "◉",
  coaching: "⌁",
  agenda: "≣",
  next: "➜",
  filter: "⌕",
};

export function teamOverviewIcon(name: string): string {
  return TEAM_OVERVIEW_ICONS[name] ?? "•";
}
