import clsx from "clsx";

/**
 * Společný povrch primárních CTA (světlý `bg-aidv-create`, tmavý stejný gradient jako „Nástroje poradce“).
 * Bez velikosti/typografie – pro skládání vlastních tlačítek.
 */
/** Společný gradient + hover/disabled/focus – bez paddingu (ikony, kompaktní CTA). */
export const portalPrimaryGradientBaseClassName = clsx(
  "relative inline-flex items-center justify-center gap-2",
  "text-white",
  "bg-aidv-create shadow-lg shadow-slate-900/20",
  "dark:!bg-[linear-gradient(180deg,rgba(217,70,239,0.26)_0%,rgba(99,102,241,0.16)_100%)]",
  "dark:border dark:border-fuchsia-500/30 dark:shadow-inner dark:shadow-black/30 dark:shadow-md",
  "transition-all duration-300 ease-out",
  "hover:bg-aidv-create-hover hover:shadow-indigo-500/25 hover:-translate-y-0.5",
  "dark:hover:!bg-[linear-gradient(180deg,rgba(217,70,239,0.34)_0%,rgba(99,102,241,0.22)_100%)]",
  "dark:hover:border-fuchsia-400/40 dark:hover:shadow-lg dark:hover:shadow-black/45",
  "active:scale-[0.96] active:translate-y-0 active:shadow-sm",
  "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-slate-900/20",
  "overflow-hidden group",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 dark:focus-visible:ring-fuchsia-400/50",
);

/**
 * Běžné primární tlačítko portálu: „Uložit“, „Odeslat“, „Další“ (normální velikost písma, ne uppercase).
 */
export const portalPrimaryButtonClassName = clsx(
  portalPrimaryGradientBaseClassName,
  "min-h-[44px] box-border rounded-xl px-5 py-2.5 text-sm font-bold",
  "no-underline",
);

/** Čtvercové primární tlačítko (např. jen ikona +). */
export const portalPrimaryIconButtonClassName = clsx(
  portalPrimaryGradientBaseClassName,
  "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl p-0 text-sm font-bold no-underline",
);

/**
 * Kanonické „Vytvořit“ (CreateActionButton): větší, uppercase, tracking.
 */
export const createActionButtonSurfaceClassName = clsx(
  portalPrimaryGradientBaseClassName,
  "px-5 py-3 min-h-[48px] box-border",
  "rounded-2xl",
  "text-xs font-black uppercase tracking-[0.15em]",
  "no-underline",
);
