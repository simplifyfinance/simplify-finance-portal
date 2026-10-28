// WHAT A LINE ON A PAYSLIP ACTUALLY IS.
//
// Every label below is a real shape of Australian payslip line - the words
// employers actually print. The employers and the people are invented.
//
// THE TEST THAT MATTERS MOST IS THE LAST ONE. Everything here is readable on
// its own, but the thing that makes a wrong classification dangerous is the
// DIRECTION it is wrong in, and the last block checks that directly.
import { describe, it, expect } from 'vitest'
import { classify, isTotal } from './payslip-lines'

const k = (label: string) => classify(label).key
const seen = (label: string) => classify(label)

describe('ordinary pay', () => {
  it('reads the many names for the same money', () => {
    for (const label of [
      'Ordinary Hours', 'ORDINARY TIME', 'Base Salary', 'Base - Salaried',
      'Salary', 'NORM', 'Normal Time', 'Standard Hours', 'Wages', 'Regular Pay',
      'Hourly Rate', 'Hours Worked',
    ]) expect(k(label), label).toBe('base')
  })

  it('AND LEAVE TAKEN IS ORDINARY PAY, NOT A SEPARATE THING', () => {
    // A payslip splits the year to date into its own buckets. Somebody who
    // took three weeks off has three weeks sitting under "Annual Leave" and
    // NOT under "Ordinary Hours". Dropping it understates them by the length
    // of their holiday - and understating is still being wrong.
    for (const label of [
      'Annual Leave', 'Personal Leave', 'Sick Leave', 'Carers Leave',
      'Long Service Leave', 'Public Holiday', 'PHOL',
    ]) expect(k(label), label).toBe('base')
  })
})

describe('allowances', () => {
  it('the ones paid every period', () => {
    for (const label of [
      'Car Allowance', 'Motor Vehicle Allowance', 'MVA', 'Tool Allowance',
      'Uniform Allowance', 'Laundry', 'First Aid Allowance', 'Higher Duties',
      'Site Allowance', 'Travel Allowance', 'LAFHA', 'Qualification Allowance',
    ]) expect(k(label), label).toBe('allowance')
  })

  it('and an allowance nobody has a rule for is still an allowance', () => {
    expect(k('Remote Area Allowance')).toBe('allowance')
    expect(k('ALLW')).toBe('allowance')
  })
})

describe('overtime, and the things that behave like it', () => {
  it('reads overtime however it is written', () => {
    for (const label of [
      'Overtime', 'O/T', 'OT 1.5', 'Time And A Half', 'Double Time',
      'Penalty Rates', 'Call Out', 'On Call', 'Standby',
    ]) expect(k(label), label).toBe('overtime')
  })

  it('SHIFT LOADING IS HERE ON PURPOSE, NOT WITH THE ALLOWANCES', () => {
    // It is regular for a shift worker, and some lenders take it in full.
    // Filed with allowances it would be taken in full in BOTH columns and the
    // question would never reach anybody. Filed here it shows 100% on the left
    // and 80% on the right, which is the whole point of two columns.
    for (const label of ['Shift Loading', 'Shift Penalty', 'Afternoon Rate', 'Night Rate']) {
      expect(k(label), label).toBe('overtime')
    }
  })
})

describe('commission', () => {
  it('is paid again and again, however lumpy, so it annualises', () => {
    for (const label of ['Commission', 'COMMS', 'Sales Commission', 'Sales Incentive']) {
      const s = seen(label)
      expect(s.key, label).toBe('commission')
      expect(s.oneOff, label).toBe(false)
    }
  })
})

describe('PAID ONCE — the lines that must never be multiplied out', () => {
  // The single biggest way an annualised figure goes wrong, and it always goes
  // wrong upwards. See lib/annualise-income.ts fault 1.
  it('a bonus by any name', () => {
    for (const label of [
      'Annual Bonus', 'Performance Bonus', 'Sign On Bonus', 'Retention Bonus',
      'Ex Gratia Payment', 'Christmas Bonus', 'Incentive Payment',
    ]) expect(seen(label).oneOff, label).toBe(true)
  })

  it('money owed for work already done', () => {
    for (const label of ['Back Pay', 'Backpay', 'Arrears', 'Retro Pay', 'Underpayment Adjustment']) {
      expect(seen(label).oneOff, label).toBe(true)
    }
  })

  it('and money paid because something ended', () => {
    for (const label of [
      'Termination Payment', 'Redundancy', 'Payment In Lieu Of Notice',
      'ETP', 'Lump Sum A', 'Severance',
    ]) expect(seen(label).oneOff, label).toBe(true)
  })

  it('A LEAVE PAYOUT IS A ONE-OFF; LEAVE TAKEN IS NOT', () => {
    // One word apart, and four times the money between them. This is why the
    // rules are ordered and why the order is tested.
    expect(seen('Annual Leave Payout').oneOff).toBe(true)
    expect(seen('Annual Leave Cash Out').oneOff).toBe(true)
    expect(seen('Annual Leave').oneOff).toBe(false)
    expect(k('Annual Leave')).toBe('base')
  })

  it('and a one-off is still income - it is taken, just not multiplied', () => {
    expect(seen('Annual Bonus').notIncome).toBe(false)
  })
})

describe('NOT INCOME — money that was never theirs to spend', () => {
  it('money handed back', () => {
    for (const label of [
      'Reimbursement', 'Travel Reimbursement', 'Expense Claim', 'Mileage',
      'KM Claim', 'Out Of Pocket',
    ]) expect(seen(label).notIncome, label).toBe(true)
  })

  it('money never paid to them at all', () => {
    for (const label of [
      'Superannuation', 'Super Guarantee', 'SGC', 'Employer Contribution',
      'PAYG Withholding', 'Tax', 'Medicare Levy', 'Salary Sacrifice',
      'Novated Lease', 'Union Fees', 'Child Support',
    ]) expect(seen(label).notIncome, label).toBe(true)
  })

  it('and a balance is not a payment', () => {
    for (const label of ['Annual Leave Balance', 'Accrued Leave', 'Hours Owing']) {
      expect(seen(label).notIncome, label).toBe(true)
    }
  })

  it('SALARY SACRIFICE IS NOT SALARY, AND IT IS READ BEFORE THE WORD SALARY', () => {
    expect(seen('Salary Sacrifice - Super').notIncome).toBe(true)
    expect(k('Salary')).toBe('base')
  })

  it('AND AN OVERTIME MEAL ALLOWANCE IS A MEAL, NOT AN ALLOWANCE', () => {
    // It carries two words that each point somewhere real. It is neither.
    expect(seen('Overtime Meal Allowance').notIncome).toBe(true)
    expect(seen('Meal Allowance').notIncome).toBe(true)
  })

  it('but "taxable allowance" is not the word tax', () => {
    expect(seen('Taxable Allowance').notIncome).toBe(false)
    expect(k('Taxable Allowance')).toBe('allowance')
  })
})

describe('when it does not know, it says so', () => {
  it('an unknown line is marked rather than guessed', () => {
    const s = seen('Site Uplift 7B')
    expect(s.recognised).toBe(false)
    expect(s.key).toBe('other')
  })

  it('and it is still counted, and still shaded', () => {
    // Dropping it would understate somebody on the strength of their
    // employer's naming. It is counted, and a person is asked.
    const s = seen('Site Uplift 7B')
    expect(s.notIncome).toBe(false)
    expect(s.oneOff).toBe(false)
  })

  it('anything it did match is marked as matched', () => {
    expect(seen('Ordinary Hours').recognised).toBe(true)
    expect(seen('Reimbursement').recognised).toBe(true)
  })

  it('and nothing at all does not throw', () => {
    for (const label of ['', '   ', '---', null as any, undefined as any]) {
      expect(classify(label).recognised, String(label)).toBe(false)
    }
  })
})

describe('a total is not a line of pay', () => {
  it('because adding it to the lines would double the income', () => {
    for (const label of ['Gross', 'Total Gross', 'Gross Earnings', 'Total Earnings', 'Gross Pay']) {
      expect(isTotal(label), label).toBe(true)
    }
  })

  it('and a real line is not a total', () => {
    for (const label of ['Ordinary Hours', 'Car Allowance', 'Overtime', 'Annual Bonus']) {
      expect(isTotal(label), label).toBe(false)
    }
  })
})

describe('THE DIRECTION OF EVERY MISTAKE', () => {
  // A wrong bucket is survivable. A wrong bucket that moves money INTO the
  // unshaded column is the one that gets a loan approved and then defaults.
  // base and allowance are the only two buckets annualise-income never shades.
  const NEVER_SHADED = ['base', 'allowance']

  it('nothing volatile is ever filed where nobody shades it', () => {
    for (const label of [
      'Overtime', 'Shift Loading', 'Penalty Rates', 'Commission',
      'Annual Bonus', 'Back Pay', 'Sign On Bonus', 'Site Uplift 7B',
    ]) expect(NEVER_SHADED.includes(k(label)), label).toBe(false)
  })

  it('and only things paid every period are', () => {
    for (const label of ['Ordinary Hours', 'Annual Leave', 'Car Allowance', 'Tool Allowance']) {
      expect(NEVER_SHADED.includes(k(label)), label).toBe(true)
    }
  })
})
