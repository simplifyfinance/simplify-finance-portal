/**
 * Refinance savings calculations.
 *
 * Pure functions, no dependencies. Used by the campaign email generator
 * and covered by refinance-calculations.test.ts.
 *
 * IMPORTANT: figures produced here go to clients under ACL 387025.
 * Every output is an estimate. The email template must carry the
 * assumptions disclaimer — see refinance-email-template.ts.
 */

export type RepaymentType = 'PI' | 'IO';

export interface RefinanceInput {
  /** Current loan balance in dollars */
  balance: number;
  /** Current annual rate, as a percentage e.g. 6.29 */
  currentRate: number;
  /** Proposed annual rate, as a percentage e.g. 5.64 */
  newRate: number;
  /** PI or IO. Must be the same on both sides of the comparison. */
  repaymentType: RepaymentType;
  /**
   * PI: remaining loan term in years.
   * IO: remaining interest-only period in years.
   */
  remainingYears: number;
  /** Lender cashback in dollars. 0 if none. */
  cashback: number;
  /** Estimated switching costs in dollars. Defaults to 800. */
  switchingCosts?: number;
}

export interface RefinanceResult {
  repaymentType: RepaymentType;
  currentRepayment: number;
  newRepayment: number;
  monthlySaving: number;
  annualSaving: number;
  /** Saving across the remaining term (PI) or remaining IO period (IO) */
  periodSaving: number;
  periodMonths: number;
  /** Cashback minus switching costs. Positive means the client is ahead. */
  netCashPosition: number;
  /**
   * PI only. Months earlier the loan is repaid if the client keeps
   * repayments at the current level after refinancing. Null for IO,
   * where no principal is being repaid.
   */
  monthsSavedIfRepaymentsHeld: number | null;
}

export class RefinanceInputError extends Error {}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Standard amortising repayment. P * r / (1 - (1+r)^-n)
 */
export function monthlyRepaymentPI(
  balance: number,
  annualRatePct: number,
  months: number,
): number {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return balance / months;
  return (balance * r) / (1 - Math.pow(1 + r, -months));
}

/**
 * Interest-only repayment. No principal component.
 */
export function monthlyRepaymentIO(
  balance: number,
  annualRatePct: number,
): number {
  return (balance * annualRatePct) / 100 / 12;
}

function validate(input: RefinanceInput): void {
  const { balance, currentRate, newRate, remainingYears, cashback } = input;

  if (!Number.isFinite(balance) || balance <= 0) {
    throw new RefinanceInputError('Enter a loan balance greater than zero');
  }
  if (!Number.isFinite(currentRate) || currentRate <= 0) {
    throw new RefinanceInputError('Enter a current rate greater than zero');
  }
  if (!Number.isFinite(newRate) || newRate <= 0) {
    throw new RefinanceInputError('Enter a new rate greater than zero');
  }
  if (newRate >= currentRate) {
    throw new RefinanceInputError(
      'The new rate must be lower than the current rate',
    );
  }
  if (!Number.isFinite(remainingYears) || remainingYears <= 0) {
    throw new RefinanceInputError('Enter a remaining term greater than zero');
  }
  if (remainingYears > 40) {
    throw new RefinanceInputError('Remaining term looks too long — check it');
  }
  if (!Number.isFinite(cashback) || cashback < 0) {
    throw new RefinanceInputError('Cashback cannot be negative');
  }
}

export function calculateRefinance(input: RefinanceInput): RefinanceResult {
  validate(input);

  const {
    balance,
    currentRate,
    newRate,
    repaymentType,
    remainingYears,
    cashback,
    switchingCosts = 800,
  } = input;

  const months = Math.round(remainingYears * 12);

  let currentRepayment: number;
  let newRepayment: number;
  let monthsSavedIfRepaymentsHeld: number | null = null;

  if (repaymentType === 'PI') {
    currentRepayment = monthlyRepaymentPI(balance, currentRate, months);
    newRepayment = monthlyRepaymentPI(balance, newRate, months);

    // If the client holds repayments at the current level, how many
    // months until the balance clears at the new rate?
    const r = newRate / 100 / 12;
    const ratio = 1 - (balance * r) / currentRepayment;
    if (ratio > 0) {
      const newTerm = -Math.log(ratio) / Math.log(1 + r);
      monthsSavedIfRepaymentsHeld = Math.max(0, Math.round(months - newTerm));
    } else {
      monthsSavedIfRepaymentsHeld = 0;
    }
  } else {
    currentRepayment = monthlyRepaymentIO(balance, currentRate);
    newRepayment = monthlyRepaymentIO(balance, newRate);
  }

  const monthlySaving = currentRepayment - newRepayment;

  return {
    repaymentType,
    currentRepayment: round2(currentRepayment),
    newRepayment: round2(newRepayment),
    monthlySaving: round2(monthlySaving),
    annualSaving: round2(monthlySaving * 12),
    periodSaving: round2(monthlySaving * months),
    periodMonths: months,
    netCashPosition: round2(cashback - switchingCosts),
    monthsSavedIfRepaymentsHeld,
  };
}

/** "3 years and 7 months" — for the PI email's strongest line. */
export function formatMonthsAsYearsMonths(totalMonths: number): string {
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? 'year' : 'years'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'month' : 'months'}`);
  if (parts.length === 0) return 'less than a month';
  return parts.join(' and ');
}

/** Australian currency, no cents. */
export function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}

/**
 * Ranking score for the campaign queue. Higher = call this client first.
 * Monthly saving is the honest proxy for how good the conversation will be.
 */
export function priorityScore(result: RefinanceResult): number {
  return Math.round(result.monthlySaving);
}
