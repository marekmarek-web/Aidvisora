/**
 * Workspace + marketing trial — jeden zdroj pravdy pro délku zkušebního období.
 *
 * Perf — dřív žil tento export v `plan-catalog.ts` (~500 ř. s capability matrixí,
 * limits a entitlement logikou). Marketing landing + pricing pages ale
 * potřebují jen tohle jedno číslo; když ho importovaly z `plan-catalog`,
 * bundler tam táhl celý katalog. Extrakce do vlastního souboru drží
 * marketing chunk štíhlý a `plan-catalog` zůstává čistý pro portal/billing.
 */
export const TRIAL_DURATION_DAYS = 14 as const;
