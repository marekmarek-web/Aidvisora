/**
 * Shared pipeline stage styling — keep mobile [`PipelineScreen`] in sync with web [`PipelineBoard`].
 */
export const PIPELINE_COLUMN_THEMES = [
  {
    color: "bg-emerald-50/80 dark:bg-emerald-950/45",
    textColor: "text-emerald-900 dark:text-emerald-200",
    borderColor: "border-emerald-100 dark:border-emerald-800/70",
    solidBg: "bg-emerald-500",
    accent: "border-b-emerald-400 dark:border-b-emerald-500",
    mobileBorderL: "border-l-emerald-500",
    mobileHeaderBar: "bg-emerald-500",
  },
  {
    color: "bg-blue-50/80 dark:bg-blue-950/45",
    textColor: "text-blue-900 dark:text-blue-200",
    borderColor: "border-blue-100 dark:border-blue-800/70",
    solidBg: "bg-blue-500",
    accent: "border-b-blue-400 dark:border-b-blue-500",
    mobileBorderL: "border-l-blue-500",
    mobileHeaderBar: "bg-blue-500",
  },
  {
    color: "bg-indigo-50/80 dark:bg-indigo-950/45",
    textColor: "text-indigo-900 dark:text-indigo-200",
    borderColor: "border-indigo-100 dark:border-indigo-800/70",
    solidBg: "bg-indigo-500",
    accent: "border-b-indigo-400 dark:border-b-indigo-500",
    mobileBorderL: "border-l-indigo-500",
    mobileHeaderBar: "bg-indigo-500",
  },
  {
    color: "bg-amber-50/80 dark:bg-amber-950/45",
    textColor: "text-amber-900 dark:text-amber-200",
    borderColor: "border-amber-100 dark:border-amber-800/70",
    solidBg: "bg-amber-500",
    accent: "border-b-amber-400 dark:border-b-amber-500",
    mobileBorderL: "border-l-amber-500",
    mobileHeaderBar: "bg-amber-500",
  },
  {
    color: "bg-rose-50/80 dark:bg-rose-950/45",
    textColor: "text-rose-900 dark:text-rose-200",
    borderColor: "border-rose-100 dark:border-rose-800/70",
    solidBg: "bg-rose-500",
    accent: "border-b-rose-400 dark:border-b-rose-500",
    mobileBorderL: "border-l-rose-500",
    mobileHeaderBar: "bg-rose-500",
  },
  {
    color: "bg-purple-50/80 dark:bg-purple-950/45",
    textColor: "text-purple-900 dark:text-purple-200",
    borderColor: "border-purple-100 dark:border-purple-800/70",
    solidBg: "bg-purple-500",
    accent: "border-b-purple-400 dark:border-b-purple-500",
    mobileBorderL: "border-l-purple-500",
    mobileHeaderBar: "bg-purple-500",
  },
] as const;

export type PipelineColumnTheme = (typeof PIPELINE_COLUMN_THEMES)[number];

export function getPipelineColumnTheme(stageIndex: number): PipelineColumnTheme {
  const n = PIPELINE_COLUMN_THEMES.length;
  const i = ((stageIndex % n) + n) % n;
  return PIPELINE_COLUMN_THEMES[i];
}
