/** Sdílené typy a konstanty pro Nastavení fondové knihovny (bez server-only). */

export const TENANT_ALLOWLIST_KEY = "fund_library.allowlist";
export const TENANT_ALLOWLIST_DOMAIN = "tenant_profile";

export type TenantFundAllowlistValue = {
  /** null = povoleny všechny fondy z katalogu */
  allowedBaseFundKeys: string[] | null;
};

export type AdvisorFundLibraryValue = {
  enabled: Record<string, boolean>;
  order: string[];
};

export type FundCatalogListItemDTO = {
  baseFundKey: string;
  displayName: string;
  provider: string;
  category: string;
  subcategory?: string;
  logoPath?: string;
};

export type FundLibrarySetupSnapshot = {
  canEditTenantAllowlist: boolean;
  tenantAllowlist: TenantFundAllowlistValue;
  advisorPrefs: AdvisorFundLibraryValue;
  effectiveAllowedKeys: string[];
  catalog: FundCatalogListItemDTO[];
};
