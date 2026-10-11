import { describe, it, expect } from 'vitest';
import { buildRefinanceEmail } from './refinance-email-template';
import {
  calculateRefinance,
  monthlyRepaymentPI,
  monthlyRepaymentIO,
  formatMonthsAsYearsMonths,
  RefinanceInputError,
  type RefinanceInput,
} from './refinance-calculations';

const PI: RefinanceInput = {
  balance: 750000, currentRate: 6.29, newRate: 5.64,
  repaymentType: 'PI', remainingYears: 27, cashback: 800,
};
const IO: RefinanceInput = { ...PI, repaymentType: 'IO', remainingYears: 3 };

/** Independent check: run the loan down one month at a time. */
function monthsToClear(balance: number, ratePct: number, payment: number): number {
  const r = ratePct / 100 / 12;
  let bal = balance;
  for (let m = 1; m <= 1200; m++) {
    bal = bal * (1 + r) - payment;
    if (bal <= 0.01) return m;
  }
  return -1;
}

describe('against published reference figures', () => {
  it('matches the standard $500k @ 6.00% over 30 years repayment', () => {
    expect(monthlyRepaymentPI(500000, 6, 360)).toBeCloseTo(2997.75, 2);
  });

  it('interest only is simply balance x rate / 12', () => {
    expect(monthlyRepaymentIO(750000, 6.29)).toBeCloseTo(3931.25, 2);
  });
});

describe('principal and interest', () => {
  const r = calculateRefinance(PI);

  it('computes both repayments', () => {
    expect(r.currentRepayment).toBeCloseTo(4816.57, 2);
    expect(r.newRepayment).toBeCloseTo(4512.75, 2);
  });

  it('computes the savings', () => {
    expect(r.monthlySaving).toBeCloseTo(303.82, 2);
    expect(r.annualSaving).toBeCloseTo(3645.89, 1);
    expect(r.periodSaving).toBeCloseTo(98439.05, 0);
  });

  it('amortises to zero at the stated term', () => {
    // Repayments are rounded to the cent, which can push the final
    // payment into an extra month. Lenders adjust the last payment.
    expect(monthsToClear(750000, 6.29, r.currentRepayment)).toBeGreaterThanOrEqual(324);
    expect(monthsToClear(750000, 6.29, r.currentRepayment)).toBeLessThanOrEqual(325);
  });

  it('agrees with simulation on the term reduction', () => {
    const simulated = 324 - monthsToClear(750000, 5.64, r.currentRepayment);
    expect(r.monthsSavedIfRepaymentsHeld).toBeGreaterThanOrEqual(simulated - 1);
    expect(r.monthsSavedIfRepaymentsHeld).toBeLessThanOrEqual(simulated + 1);
    expect(formatMonthsAsYearsMonths(43)).toBe('3 years and 7 months');
  });
});

describe('interest only', () => {
  const r = calculateRefinance(IO);

  it('computes the cashflow gain', () => {
    expect(r.monthlySaving).toBeCloseTo(406.25, 2);
    expect(r.periodSaving).toBeCloseTo(14625, 2);
  });

  it('never claims a term reduction — no principal is being repaid', () => {
    expect(r.monthsSavedIfRepaymentsHeld).toBeNull();
  });

  it('scopes the period to the remaining IO window, not the loan term', () => {
    expect(r.periodMonths).toBe(36);
  });
});

describe('input guards', () => {
  const bad = (o: Partial<RefinanceInput>) =>
    () => calculateRefinance({ ...PI, ...o });

  it('rejects a new rate at or above the current rate', () => {
    expect(bad({ newRate: 6.29 })).toThrow(RefinanceInputError);
    expect(bad({ newRate: 7 })).toThrow(RefinanceInputError);
  });

  it('rejects nonsense inputs', () => {
    expect(bad({ balance: 0 })).toThrow(RefinanceInputError);
    expect(bad({ balance: NaN })).toThrow(RefinanceInputError);
    expect(bad({ cashback: -100 })).toThrow(RefinanceInputError);
    expect(bad({ remainingYears: 60 })).toThrow(RefinanceInputError);
  });
});

describe('net cash position', () => {
  it('is zero when an $800 cashback meets $800 of costs', () => {
    expect(calculateRefinance(PI).netCashPosition).toBe(0);
  });

  it('goes negative when costs exceed the cashback', () => {
    expect(calculateRefinance({ ...PI, cashback: 0 }).netCashPosition).toBe(-800);
  });
});

// ---------------------------------------------------------------------------
// THE REFINANCE EMAIL CARRIES THE RBA NOTICE, AND HAS NO AMBER IN IT.
//
// 9 Oct 2026, both found in an audit.
//
// It quotes TWO live interest rates to a client - "Your rate now" and "Your new
// rate" - and had no connection to the rate notice at all. Not switched off for
// a reason: never wired. The other four client emails that quote a rate are
// built on the server, where reaching Settings is easy; this one is built in
// the browser, which is why it was the one that got missed.
//
// And its cashback box was amber, which Fabio has ruled out everywhere.
describe('the refinance email and the rate notice', () => {
  const input = {
    balance: 650000, currentRate: 5.89, newRate: 5.49,
    remainingYears: 27, repaymentType: 'PI' as const, cashback: 0,
  }
  const ctx = {
    clientFirstName: 'Dervla', brokerName: 'Fabio de Castro',
    calendlyUrl: 'https://calendly.com/fabio', proceedUrl: 'https://example.com/proceed',
  }
  const NOTICE = 'Please note, the rates quoted above do not factor in the recent RBA rate change.'

  it('prints the notice when it is handed one', () => {
    const out = buildRefinanceEmail(input, { ...ctx, rateNotice: NOTICE })
    expect(out.html).toContain(NOTICE)
    expect(out.plainText).toContain(NOTICE)
  })

  it('prints nothing at all when there is none', () => {
    const out = buildRefinanceEmail(input, { ...ctx, rateNotice: '' })
    expect(out.html).not.toContain('RBA')
    // And the email is otherwise unchanged - the rates are still there.
    expect(out.html).toContain('5.89')
    expect(out.html).toContain('5.49')
  })

  it('treats a blank one as none, not as an empty box', () => {
    const out = buildRefinanceEmail(input, { ...ctx, rateNotice: '   ' })
    expect(out.html).not.toContain('border-left:3px solid #B4B2A9')
  })

  it('has no amber in it', () => {
    // The cashback box. Green, like the saving figures it sits beside.
    const out = buildRefinanceEmail({ ...input, cashback: 3000 }, ctx)
    for (const amber of ['#FDF6E7', '#7A5F17']) {
      expect(out.html, `${amber} is amber and is in a client email`).not.toContain(amber)
    }
  })
})
