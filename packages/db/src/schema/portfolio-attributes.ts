/**
 * Kanonický typ JSONB `contracts.portfolio_attributes`.
 * Aplikační mapování z extraktu: `apps/web/src/lib/portfolio/build-portfolio-attributes-from-extract.ts`.
 */

export type CoverageLineUi = { label?: string; amount?: string; description?: string };

export type PortfolioPersonRole =
  | "policyholder"
  | "insured"
  | "child"
  | "beneficiary"
  | "other";

export type PortfolioPersonEntry = {
  role: PortfolioPersonRole;
  name?: string;
  birthDate?: string;
  personalId?: string;
};

export type PortfolioRiskEntry = {
  label: string;
  amount?: string;
  personRef?: string;
  description?: string;
};

export type PortfolioAttributes = {
  loanPrincipal?: string;
  sumInsured?: string;
  insuredPersons?: unknown;
  persons?: PortfolioPersonEntry[];
  risks?: PortfolioRiskEntry[];
  coverageLines?: CoverageLineUi[];
  vehicleRegistration?: string;
  propertyAddress?: string;
  subcategory?: string;
  loanFixationUntil?: string;
  loanMaturityDate?: string;
  /** DPS / DIP — příspěvek účastníka (měsíčně) */
  participantContribution?: string;
  /** DPS / DIP — příspěvek zaměstnavatele (měsíčně) */
  employerContribution?: string;
  /** DPS — odhadovaný státní příspěvek (derived: 20 % z participantContribution, max 340 CZK/měs.) */
  stateContributionEstimate?: string;
  /** Investiční strategie (profil / název strategie) */
  investmentStrategy?: string;
  /** Investiční fondy s případnou alokací */
  investmentFunds?: Array<{ name: string; allocation?: string }>;
  /** Investiční horizont (např. „20 let", „do roku 2045") */
  investmentHorizon?: string;
  /** Cílová částka investice */
  targetAmount?: string;
  /** Předpokládaná budoucí hodnota (z modelace / ilustrace) */
  expectedFutureValue?: string;
  [key: string]: unknown;
};
