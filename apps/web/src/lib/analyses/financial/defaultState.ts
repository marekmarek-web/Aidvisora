/**
 * Financial analysis – default state and initial data.
 * Extracted from financni-analyza.html (Phase 1).
 */

import type { FinancialAnalysisData, InvestmentEntry } from './types';
import { TOTAL_STEPS } from './constants';

/** Výchozí prázdné investice — řádky doplní synchronizace s fondovou knihovnou při načtení wizardu. */
export function getDefaultInvestments(): InvestmentEntry[] {
  return [];
}

/** Full default data structure for a new analysis. */
export function getDefaultState(): FinancialAnalysisData {
  return {
    client: {
      name: '',
      birthDate: '',
      age: '',
      email: '',
      phone: '',
      occupation: '',
      sports: '',
      hasPartner: false,
      birthNumber: '',
    },
    partner: { name: '', birthDate: '', occupation: '', sports: '', birthNumber: '' },
    children: [],
    includeCompany: false,
    companyFinance: undefined,
    cashflow: {
      incomeType: 'zamestnanec',
      incomeGross: 0,
      partnerIncomeType: 'zamestnanec',
      partnerGross: 0,
      incomes: { otherDetails: [] },
      expenses: { otherDetails: [], insuranceItems: [] },
      reserveCash: 0,
      reserveTargetMonths: 6,
      reserveGap: 0,
      isReserveMet: false,
    },
    assets: {
      cash: 0,
      realEstate: 0,
      investments: 0,
      investmentsList: [],
      pension: 0,
      pensionList: [],
      other: 0,
    },
    liabilities: {
      mortgage: 0,
      mortgageDetails: { rate: 0, fix: 0, pay: 0 },
      mortgageProvider: '',
      loans: 0,
      loansDetails: { rate: 0, pay: 0 },
      loansList: [],
      other: 0,
      otherDesc: '',
      otherProvider: '',
    },
    goals: [],
    newCreditWishList: [],
    strategy: { profile: 'balanced', conservativeMode: false },
    investments: getDefaultInvestments(),
    insurance: { riskJob: 'low', invalidity50Plus: false },
    incomeProtection: { persons: [] },
    notes: null,
  };
}

/** Initial wizard step. */
export const DEFAULT_CURRENT_STEP = 1;

/** Total number of steps (for reference). */
export { TOTAL_STEPS };
