// "PLEASE RESET EACH MORNING SO THAT IT SHOWS ALL DEAL CARDS IN EACH SUB TAB."
//
// Julian Kok, 17 Nov 2026, and Belle the same day: "Julian is right."
import { describe, it, expect } from 'vitest'
import {
  ALL, CLOSE_OUT, SPLIT_COLUMNS, hasSubTabs, subTabOf, subTabsFor, countsFor, cardsOn,
  showingWords, toCloseOut,
} from './board-subtabs'

const on = (stage: string, over: any = {}) => ({ settlement_stage: stage, ...over })

describe('which columns split', () => {
  it('three of them, and no others', () => {
    expect(SPLIT_COLUMNS).toEqual(['formal', 'contracts_returned', 'settled'])
    expect(hasSubTabs('formal')).toBe(true)
    expect(hasSubTabs('settlement_booked')).toBe(false)
    expect(hasSubTabs('lodged')).toBe(false)
  })

  it('and each offers All first, then the work in order', () => {
    expect(subTabsFor('formal').map(t => t.label)).toEqual(['All', 'Formal', 'Contracts issued'])
    expect(subTabsFor('contracts_returned').map(t => t.label))
      .toEqual(['All', 'Contracts reviewing', 'Outstandings', 'Pending booking'])
    expect(subTabsFor('settled').map(t => t.label)).toEqual(['All', 'To close out'])
  })
})

describe('which tab a card sits under', () => {
  it('its own step, where the step belongs to that column', () => {
    expect(subTabOf(on('contracts_issued'), 'formal')).toBe('contracts_issued')
    expect(subTabOf(on('outstandings'), 'contracts_returned')).toBe('outstandings')
    expect(subTabOf(on('pending_booking'), 'contracts_returned')).toBe('pending_booking')
  })

  // EVERY DEAL IN THE BOOK ON THE MORNING THIS SHIPS. A column that showed
  // nought of everything on day one would read as broken.
  it('a deal nobody has put on a step goes to the first sub-step of its column', () => {
    expect(subTabOf({}, 'formal')).toBe('formal')
    expect(subTabOf({}, 'contracts_returned')).toBe('contracts_reviewing')
  })

  it('and a step belonging to another column does not drag it across', () => {
    expect(subTabOf(on('settlement_booked'), 'contracts_returned')).toBe('contracts_reviewing')
  })
})

// SETTLED, BUT THE REVIEW, COMPLIANCE OR COMMISSION IS STILL OPEN.
describe('to close out', () => {
  const settled = { settled_at: '2026-11-06' }

  it('is a settled deal with something still open on it', () => {
    expect(toCloseOut({ ...settled })).toBe(true)
    expect(toCloseOut({ ...settled, review_sent: true })).toBe(true)
    expect(toCloseOut({ ...settled, review_sent: true, compliance_finalised: true })).toBe(true)
  })

  it('and not one where all three are done', () => {
    expect(toCloseOut({ ...settled, review_sent: true, compliance_finalised: true, commission_paid: true }))
      .toBe(false)
  })

  it('a deal that has not settled is not waiting to be closed out', () => {
    expect(toCloseOut({})).toBe(false)
  })

  it('and it is the tab it lands on', () => {
    expect(subTabOf({ ...settled }, 'settled')).toBe(CLOSE_OUT)
    expect(subTabOf({ ...settled, review_sent: true, compliance_finalised: true, commission_paid: true },
      'settled')).toBe(ALL)
  })
})

describe('the counts on the tabs', () => {
  const cards = [on('formal'), on('formal'), on('contracts_issued'), {}]

  it('All is everything, and each tab is its own', () => {
    const c = countsFor(cards, 'formal')
    expect(c[ALL]).toBe(4)
    expect(c.formal).toBe(3)       // two on the step, one never put on one
    expect(c.contracts_issued).toBe(1)
  })

  it('a tab with nothing in it still answers nought rather than nothing', () => {
    expect(countsFor([], 'contracts_returned').outstandings).toBe(0)
  })
})

describe('what a tab shows', () => {
  const cards = [on('outstandings', { id: 'a' }), on('pending_booking', { id: 'b' }),
                 on('outstandings', { id: 'c' })]

  it('only the cards on that step', () => {
    expect(cardsOn(cards, 'contracts_returned', 'outstandings').map(d => d.id)).toEqual(['a', 'c'])
  })

  // ALL SHOWS EVERYTHING, ALWAYS. It is where the board opens every morning.
  it('and All shows every card in the column', () => {
    expect(cardsOn(cards, 'contracts_returned', ALL)).toHaveLength(3)
    expect(cardsOn(cards, 'contracts_returned', '')).toHaveLength(3)
  })
})

// A FILTERED COLUMN MUST NEVER READ AS AN EMPTY ONE.
describe('the line under the tabs', () => {
  it('says what is being shown and out of what', () => {
    expect(showingWords(2, 7, 'outstandings')).toBe('Showing 2 of 7')
  })

  it('and says nothing at all when nothing is filtered', () => {
    expect(showingWords(7, 7, ALL)).toBe('')
    expect(showingWords(7, 7, '')).toBe('')
  })
})
