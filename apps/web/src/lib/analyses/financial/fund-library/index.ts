/**
 * Centrální fondová knihovna — katalog base fondů, varianty, legacy mapa.
 * Wizard / HTML report zatím čtou `FUND_DETAILS`; tento modul je zdroj pravdy pro další přepojení.
 */

export * from "./types";
export * from "./legacy-fund-key-map";
export * from "./helpers";
export { BASE_FUNDS } from "./base-funds";
export { FUND_VARIANTS } from "./fund-variants";
