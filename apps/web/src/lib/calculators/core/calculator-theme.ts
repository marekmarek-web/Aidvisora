/**
 * Shared design tokens for all calculators.
 * Baseline from investment calculator; use in core components for consistency.
 */

export const CALCULATOR_THEME = {
  colors: {
    brandDark: "#0a0f29",
    brandGold: "#fbbf24",
    brandLightGold: "#fde047",
    brandMain: "#0B3A7A",
    brandLight: "#EAF3FF",
    brandBorder: "#D6E6FF",
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
    sectionTitle: "text-3xl font-bold text-[#0a0f29] mb-8 text-center uppercase tracking-widest",
    cardTitle: "text-lg font-bold text-[#0a0f29] flex items-center justify-center gap-2 mb-4",
    valueLabel: "text-slate-400 font-medium mb-2 text-sm uppercase tracking-wider",
    valueMain: "text-4xl md:text-5xl font-black text-white tracking-tight",
  },
} as const;
