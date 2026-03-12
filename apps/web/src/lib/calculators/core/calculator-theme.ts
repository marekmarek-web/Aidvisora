/**
 * Shared design tokens for calculators – CRM palette (indigo/emerald, no yellow).
 * Use in core components for consistency with Aidvisora.
 */

export const CALCULATOR_THEME = {
  colors: {
    /** Dark card background (result panels) */
    cardDark: "#0b1120",
    /** Accent: buttons, active tabs, focus */
    accent: "indigo", // use Tailwind indigo-500, indigo-600, focus:ring-indigo
    /** Success / highlight: best rate, TOP VOLBA, positive numbers */
    success: "emerald", // use Tailwind emerald-400, emerald-500
    /** Neutrals */
    border: "slate-200",
    label: "slate-400",
    text: "slate-900",
  },
  spacing: {
    sectionPaddingY: "pt-28 pb-10 md:py-20 lg:pt-32",
    sectionPaddingX: "px-4 sm:px-6 lg:px-8",
    cardPadding: "p-6 md:p-8",
    inputGap: "gap-8",
    gridGap: "gap-8",
  },
  layout: {
    maxWidthShell: "max-w-7xl",
    inputCols: "lg:col-span-7",
    resultsCols: "lg:col-span-5",
    chartMinHeight: "min-h-[300px]",
    resultsCardMinWidth: "min-w-[240px]",
  },
  typography: {
    heroTitle: "text-3xl md:text-5xl font-extrabold mb-4 leading-tight",
    heroSubtitle: "text-blue-100 opacity-90 text-lg mb-8 max-w-2xl leading-relaxed",
    sectionTitle: "text-3xl font-bold text-slate-900 mb-8 text-center uppercase tracking-widest",
    cardTitle: "text-lg font-bold text-slate-900 flex items-center justify-center gap-2 mb-4",
    valueLabel: "text-slate-400 font-medium mb-2 text-sm uppercase tracking-wider",
    valueMain: "text-4xl md:text-5xl font-black text-white tracking-tight",
  },
} as const;
