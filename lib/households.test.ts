import { describe, it, expect } from 'vitest'
import { MAX_HOUSEHOLDS, householdOf, householdsOf, householdCount, isOneHousehold,
         dependantsFor, totalDependants, setDependants, canAddHousehold,
         nextHouseholdId, suggestSecondHousehold } from './households'
import { expensesFor, writeExpenses, everyHousehold, movePerson } from './household-expenses'

// Fabio, 17 Sep 2026: two applicants who are not a couple are two households -
// their own dependants, their own living expenses, their own HEM benchmark.

const app = (over: any = {}) => ({ id: 'a1', firstName: 'Emma', lastName: 'Byrnes', relationshipStatus: 'Single', ...over })
const ff = (over: any = {}) => ({
  applicants: [app(), app({ id: 'a2', firstName: 'Joshua', lastName: 'Byrnes' })],
  dependants: '2', ...over,
})

describe('everyone is in one household until somebody says otherwise', () => {
  it('a blank household is household 1, not a missing answer', () => {
    expect(householdOf({})).toBe('1')
    expect(householdOf({ household: '' })).toBe('1')
    expect(householdOf(null)).toBe('1')
  })

  it('rubbish in the field is still household 1', () => {
    expect(householdOf({ household: '9' })).toBe('1')
    expect(householdOf({ household: 'yes' })).toBe('1')
  })

  it('a couple is one household and the screen stays as it is', () => {
    expect(householdCount(ff())).toBe(1)
    expect(isOneHousehold(ff())).toBe(true)
  })

  it('a deal with nobody on it still has household 1 to draw', () => {
    expect(householdsOf({ applicants: [] })).toHaveLength(1)
    expect(householdsOf({})).toHaveLength(1)
  })
})

describe('two and three households', () => {
  const two = ff({ applicants: [app(), app({ id: 'a2', firstName: 'Joshua', lastName: 'Byrnes', household: '2' })] })
  const three = ff({ applicants: [app(), app({ id: 'a2', firstName: 'Joshua', lastName: 'Byrnes', household: '2' }),
                                  app({ id: 'a3', firstName: 'Priya', lastName: 'Rao', household: '3' })] })

  it('puts each person under their own roof, in deal order', () => {
    expect(householdsOf(two).map(h => h.people.map(p => p.name))).toEqual([['Emma Byrnes'], ['Joshua Byrnes']])
    expect(householdCount(three)).toBe(3)
  })

  it('never offers a fourth', () => {
    expect(MAX_HOUSEHOLDS).toBe(3)
    expect(nextHouseholdId(three)).toBe(null)
    expect(canAddHousehold(three)).toBe(false)
  })

  it('will not open a household nobody can move into', () => {
    // Two people already in two households: opening a third would empty one.
    expect(canAddHousehold(two)).toBe(false)
    // Three under one roof: one of them can leave.
    const crowded = ff({ applicants: [app(), app({ id: 'a2' }), app({ id: 'a3' })] })
    expect(canAddHousehold(crowded)).toBe(true)
    expect(nextHouseholdId(crowded)).toBe('2')
  })

  it('a single applicant is never two households', () => {
    expect(canAddHousehold(ff({ applicants: [app()] }))).toBe(false)
  })
})

describe('dependants: the deal total stays the truth', () => {
  const two = ff({ applicants: [app(), app({ id: 'a2', firstName: 'Joshua', lastName: 'Byrnes', household: '2' })] })

  it('household 1 carries the number that was already on the deal', () => {
    expect(dependantsFor(two, '1')).toBe('2')
    expect(dependantsFor(two, '2')).toBe('0')
  })

  it('setting one household keeps the deal total in step', () => {
    const patch = setDependants(two, '2', '1')
    expect(patch.householdDependants).toEqual({ '2': '1' })
    expect(patch.dependants, 'the total must be the sum, not a second opinion').toBe('3')
  })

  it('the total is the sum of the households once they are used', () => {
    const used = { ...two, householdDependants: { '1': '2', '2': '1' } }
    expect(totalDependants(used)).toBe(3)
  })

  it('a one household deal reads the number exactly as it always has', () => {
    expect(totalDependants(ff())).toBe(2)
    expect(dependantsFor(ff(), '1')).toBe('2')
  })
})

describe('the suggestion is offered, never applied', () => {
  it('speaks up when two applicants are both Single and under one roof', () => {
    expect(suggestSecondHousehold(ff())).toBe(true)
  })

  it('stays quiet once somebody has moved', () => {
    expect(suggestSecondHousehold(ff({
      applicants: [app(), app({ id: 'a2', household: '2' })] }))).toBe(false)
  })

  it('stays quiet for a couple', () => {
    expect(suggestSecondHousehold(ff({
      applicants: [app({ relationshipStatus: 'De facto', relatedToApplicantId: 'a2' }),
                   app({ id: 'a2', relationshipStatus: 'De facto', relatedToApplicantId: 'a1' })] })))
      .toBe(false)
  })

  it('NEVER speaks up on a blank relationship status - a blank is not evidence', () => {
    expect(suggestSecondHousehold(ff({
      applicants: [app({ relationshipStatus: '' }), app({ id: 'a2' })] }))).toBe(false)
  })

  it('stays away for good once it has been put away', () => {
    expect(suggestSecondHousehold(ff({ householdsDismissed: 'yes' }))).toBe(false)
  })

  it('says nothing about one applicant', () => {
    expect(suggestSecondHousehold(ff({ applicants: [app()] }))).toBe(false)
  })
})

describe('where each household keeps its expenses', () => {
  const legacy = { expenses: { groceries: { monthlyAmount: '1400', splits: { Emma: '100' }, comment: '' } } }

  it('household 1 is the record every existing deal already has', () => {
    expect(expensesFor(legacy, '1').groceries.monthlyAmount).toBe('1400')
  })

  it('a household nobody has typed into comes back empty, not undefined', () => {
    expect(expensesFor(legacy, '2')).toEqual({})
    expect(expensesFor(null, '1')).toEqual({})
  })

  it('writing household 1 writes the field it has always written to', () => {
    const patch = writeExpenses(legacy, '1', { rent: { monthlyAmount: '0', splits: {}, comment: '' } })
    expect(Object.keys(patch)).toEqual(['expenses'])
  })

  it('writing household 2 never touches household 1', () => {
    const patch = writeExpenses(legacy, '2', { rent: { monthlyAmount: '2100', splits: {}, comment: '' } })
    expect(Object.keys(patch)).toEqual(['expensesByHousehold'])
    expect(patch.expensesByHousehold!['2'].rent.monthlyAmount).toBe('2100')
    expect(legacy.expenses.groceries.monthlyAmount, 'household 1 was written over').toBe('1400')
  })

  it('reads every household in order for the handover', () => {
    const d = { ...legacy, expensesByHousehold: { '2': { rent: { monthlyAmount: '2100', splits: {}, comment: '' } } } }
    const all = everyHousehold(d, ['1', '2'])
    expect(all.map(h => h.id)).toEqual(['1', '2'])
    expect(all[1].expenses.rent.monthlyAmount).toBe('2100')
  })
})

describe('moving somebody never deletes what was typed', () => {
  const rec = {
    groceries: { monthlyAmount: '1400', splits: { Emma: '60', Joshua: '40' }, comment: 'weekly' },
  }

  it('takes their column out of the household they left, and leaves the money', () => {
    const after = movePerson(rec, 'Joshua', true)
    expect(after.groceries.splits).toEqual({ Emma: '60' })
    expect(after.groceries.monthlyAmount, 'the amount belongs to the household').toBe('1400')
    expect(after.groceries.comment).toBe('weekly')
  })

  it('gives them a blank column in the household they joined', () => {
    const after = movePerson({ rent: { monthlyAmount: '2100', splits: {}, comment: '' } }, 'Joshua', false)
    expect(after.rent.splits).toEqual({ Joshua: '' })
  })

  it('leaves a column that is already there alone', () => {
    expect(movePerson(rec, 'Emma', false).groceries.splits.Emma).toBe('60')
  })
})

describe('the name is the one the expense columns are keyed by', () => {
  it('is first and last together, exactly as applicantsOf builds it', () => {
    const h = householdsOf({ applicants: [{ firstName: 'Emma', lastName: 'Byrnes' }] })
    expect(h[0].people[0].name).toBe('Emma Byrnes')
  })

  it('falls back to a numbered applicant rather than an empty column', () => {
    const h = householdsOf({ applicants: [{}] })
    expect(h[0].people[0].name).toBe('Applicant 1')
  })
})

// ---------------------------------------------------------------------------
// THE HANDOVER, which is the thing the lender actually reads.

import { handoverSections } from './handover-view'

const withHomes = (households: 1 | 2) => ({
  id: 'deal-1',
  fact_find_data: {
    dependants: '2',
    householdDependants: households === 2 ? { '1': '2', '2': '0' } : undefined,
    applicants: households === 2
      ? [{ firstName: 'Emma', lastName: 'Byrnes' },
         { firstName: 'Joshua', lastName: 'Byrnes', household: '2' }]
      : [{ firstName: 'Emma', lastName: 'Byrnes' },
         { firstName: 'Joshua', lastName: 'Byrnes' }],
  },
  compliance_data: {
    applicants: [{ name: 'Emma Byrnes' }, { name: 'Joshua Byrnes' }],
    expenses: { groceries: { monthlyAmount: '1400', splits: {}, comment: '' } },
    expensesByHousehold: households === 2
      ? { '2': { groceries: { monthlyAmount: '620', splits: {}, comment: '' } } }
      : undefined,
  },
})

const expensesSection = (deal: any) =>
  handoverSections(deal).find(s => s.key === 'expenses')!

describe('the handover a lender reads', () => {
  it('is exactly one card on an ordinary deal', () => {
    const s = expensesSection(withHomes(1))
    expect(s.cards).toHaveLength(1)
    expect(s.cards[0].title).toBe('Monthly expenses')
    expect(s.pill).toBe('household monthly')
  })

  it('NEVER hands over one household on a two household deal', () => {
    const s = expensesSection(withHomes(2))
    const titles = s.cards.map(c => c.title)
    expect(titles).toContain('Household 1 — monthly expenses')
    expect(titles).toContain('Household 2 — monthly expenses')
  })

  it('names who lives in each one, so the assessor is not guessing', () => {
    const s = expensesSection(withHomes(2))
    const who = s.cards[0].rows.find((r: any) => r.k === 'Who lives here') as any
    expect(who.v).toContain('Emma Byrnes')
    expect(who.v).toContain('2 dependants')
  })

  it('adds them up on a card of their own, never inside a household', () => {
    const s = expensesSection(withHomes(2))
    const all = s.cards.find(c => c.key === 'expenses-all')!
    expect(all.tag).toContain('2,020')          // 1,400 + 620
    expect(all.note).toMatch(/not one household/i)
    // And each household's own card still shows only its own money.
    expect(s.cards[0].tag).toContain('1,400')
    expect(s.cards[1].tag).toContain('620')
  })

  it('says how many households in the heading', () => {
    expect(expensesSection(withHomes(2)).pill).toBe('2 households, monthly')
  })
})
