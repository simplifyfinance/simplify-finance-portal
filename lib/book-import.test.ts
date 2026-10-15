import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  FIELDS, guessMapping, whatIsMissing, num, day, peopleIn, clientKey,
  balanceOf, groupByClient, headroom, worthOpeningFirst,
  positionProperties, rowKeyFor, planTheImport, countThePlan,
} from './book-import'

// MEASURED AGAINST THE REAL EXPORT, NOT AN IMAGINED ONE.
//
// 15 Oct 2026. The file is 796 rows, 656 clients, settlements from March 2020
// to September 2026. Every shape below was taken from it - the headers exactly
// as they are spelled, the comma-separated applicant groups, and the balance
// double-count. The names and figures here are invented; the SHAPES are not.
//
// This is the lesson from the PDF reader, written down as a test file: that
// code was verified against a tidy document somebody generated to try it out,
// passed, and fell over on the first real one it saw.

// The headers as the CRM actually spells them, newlines and all.
const HEADERS = [
  'Deal Name', 'Deal Owner', 'Deal Ref', 'Contact - group data - full name',
  'Deal labels', 'Date deal created', 'Settlement Date', 'Lender',
  'Total Loan amount', 'LVR', 'Security 1 address', 'Security 1 postcode',
  'Security 1 state', 'Security 1 zoning', 'Security 1 value',
  'Security Property 1 type', 'Security 1 Ownership Type', 'Security 1 Valuation',
  'Maximum borrowing', 'Product split 1 - name', 'Commission\nLoan ID(s)',
  'Current\nBalance', 'Last Commission\nPaid', 'Match\nType',
]

const M = guessMapping(HEADERS)

const row = (over: any = {}) => ({
  'Deal Owner': 'Fabio De Castro',
  'Deal Ref': 'tc2-' + Math.random().toString(36).slice(2, 10),
  'Contact - group data - full name': 'Daniel Whitmore, Rachel Whitmore',
  'Settlement Date': new Date(2022, 4, 18),
  'Lender': 'Bankwest',
  'Total Loan amount': 432000,
  'Security 1 address': '14 Marlowe Street, Brunswick VIC 3056',
  'Security 1 postcode': 3056,
  'Security 1 state': 'VIC',
  'Security 1 zoning': 'Residential',
  'Security 1 value': 540000,
  'Security Property 1 type': 'Fully Detached House',
  'Security 1 Ownership Type': 'Investment',
  'Commission\nLoan ID(s)': '985-189326-4',
  'Current\nBalance': 398220,
  ...over,
})

describe('working out which column is which', () => {
  it('finds every field in the real header row', () => {
    expect(whatIsMissing(M)).toEqual([])
    expect(M.contact).toBe('Contact - group data - full name')
    expect(M.dealRef).toBe('Deal Ref')
    expect(M.address).toBe('Security 1 address')
    expect(M.ownershipType).toBe('Security 1 Ownership Type')
  })

  it('sees through a newline in the middle of a header', () => {
    // 'Commission\nLoan ID(s)' is how the CRM exports it.
    expect(M.loanIds).toBe('Commission\nLoan ID(s)')
    expect(M.currentBalance).toBe('Current\nBalance')
  })

  it('does not give the loan ids column to the loan amount', () => {
    // 'loanids' is tried before 'loan' for exactly this reason.
    expect(M.loanAmount).toBe('Total Loan amount')
    expect(M.loanAmount).not.toBe(M.loanIds)
  })

  it('never hands the same column to two fields', () => {
    const used = Object.values(M)
    expect(new Set(used).size).toBe(used.length)
  })

  it('says what is missing rather than importing half a book', () => {
    const missing = whatIsMissing(guessMapping(['Lender', 'Balance']))
    expect(missing).toContain('Client name')
    expect(missing).toContain('Property address')
  })

  it('every field carries a label a person can act on', () => {
    for (const f of FIELDS) expect(f.label.length).toBeGreaterThan(2)
  })
})

describe('reading a cell', () => {
  it('takes a number however it was typed', () => {
    expect(num(540000)).toBe(540000)
    expect(num('$540,000')).toBe(540000)
    expect(num('')).toBeNull()
    expect(num(null)).toBeNull()
  })

  it('reads a date without letting it drift a day', () => {
    // toISOString() on a local Date moves an early-morning date back a day in
    // Australia. Built from local parts instead.
    expect(day(new Date(2022, 4, 18))).toBe('2022-05-18')
    expect(day(new Date(2022, 0, 1, 2, 0))).toBe('2022-01-01')
    expect(day('2022-05-18T00:00:00Z')).toBe('2022-05-18')
    expect(day('18/05/2022')).toBe('2022-05-18')
    expect(day('nonsense')).toBe('')
  })

  it('unwraps the shapes ExcelJS hands back', () => {
    expect(num({ result: 540000 } as any)).toBe(540000)
    expect(day({ text: '2022-05-18' } as any)).toBe('2022-05-18')
  })
})

describe('the people in a name', () => {
  it('splits a couple', () => {
    const p = peopleIn('Daniel Whitmore, Rachel Whitmore')
    expect(p).toHaveLength(2)
    expect(p[0]).toEqual({ first: 'Daniel', last: 'Whitmore', whole: 'Daniel Whitmore' })
    expect(p[1].first).toBe('Rachel')
  })

  it('handles three and four applicants, which 99 of the 656 have', () => {
    expect(peopleIn('A Bee, C Dee, E Eff')).toHaveLength(3)
    expect(peopleIn('A Bee & C Dee')).toHaveLength(2)
    expect(peopleIn('A Bee and C Dee')).toHaveLength(2)
  })

  it('keeps a double-barrelled surname together', () => {
    expect(peopleIn('Maria Santos Oliveira')[0])
      .toEqual({ first: 'Maria Santos', last: 'Oliveira', whole: 'Maria Santos Oliveira' })
  })

  it('LEAVES A COMPANY OR A TRUST WHOLE', () => {
    // Splitting on the spaces would invent a person called Family Super.
    const p = peopleIn('Whitmore Family Super Pty Ltd')
    expect(p).toHaveLength(1)
    expect(p[0].first).toBe('Whitmore Family Super Pty Ltd')
    expect(p[0].last).toBe('')
  })

  it('gives two spellings of the same group the same key', () => {
    expect(clientKey('Daniel Whitmore,  Rachel Whitmore'))
      .toBe(clientKey('Daniel Whitmore, Rachel Whitmore'))
  })
})

// THE ONE THAT MATTERS MOST.
//
// Measured on the real file: adding the balance column up gives $220,831,180.
// The truth is $208,352,905. Eleven clients are affected and the worst is out
// by $6m - and those eleven are multi-property investors, which is to say
// exactly the people this project exists to find.
describe('what a client actually owes', () => {
  it('adds up loans that are genuinely separate', () => {
    expect(balanceOf([
      { loanIds: ['A'], balance: 248081 },
      { loanIds: ['B'], balance: 264118 },
    ])).toBe(512199)
  })

  it('does NOT count the same loan twice when it funded two deals', () => {
    // One loan, two rows. This is the shape that overstates a real client.
    expect(balanceOf([
      { loanIds: ['A'], balance: 417217 },
      { loanIds: ['A'], balance: 417217 },
    ])).toBe(417217)
  })

  it('does NOT add a row that is the SUM of loans already counted', () => {
    // The real case: two singles, then a row carrying all three together.
    expect(balanceOf([
      { loanIds: ['A'], balance: 417217 },
      { loanIds: ['B'], balance: 186334 },
      { loanIds: ['A', 'B', 'C'], balance: 1020769 },
    ])).toBe(1020769)
  })

  it('keeps two overlapping sets that neither contains the other', () => {
    // Nothing can be safely dropped here, so nothing is - better to be high
    // than to silently lose a loan.
    expect(balanceOf([
      { loanIds: ['A', 'B'], balance: 500000 },
      { loanIds: ['B', 'C'], balance: 400000 },
    ])).toBe(900000)
  })

  it('says nothing rather than zero when no loan is matched', () => {
    // 278 of the 656 have no commission match at all - they refinanced away
    // or paid out. Zero would say they owe nothing, which is a claim.
    expect(balanceOf([{ loanIds: [], balance: null }])).toBeNull()
    expect(balanceOf([])).toBeNull()
  })
})

describe('building a client out of their rows', () => {
  const rows = [
    row(),
    row({ 'Security 1 address': '7/22 Kestrel Avenue, Coorparoo QLD 4151',
          'Security 1 value': 465000, 'Total Loan amount': 372000,
          'Commission\nLoan ID(s)': '227769', 'Current\nBalance': 351900,
          'Settlement Date': new Date(2024, 1, 2), 'Lender': 'MA Money' }),
    row({ 'Security 1 address': '61 Harrow Road, Glen Iris VIC 3146',
          'Security 1 Ownership Type': 'Owner Occupied',
          'Security 1 value': 980000, 'Total Loan amount': 700000,
          'Commission\nLoan ID(s)': '985-189327-1', 'Current\nBalance': 612400 }),
  ]
  const [c] = groupByClient(rows, M)

  it('turns three rows into one client with three properties', () => {
    expect(groupByClient(rows, M)).toHaveLength(1)
    expect(c.properties).toHaveLength(3)
    expect(c.dealRefs).toHaveLength(3)
  })

  it('carries every applicant', () => {
    expect(c.people.map(p => p.first)).toEqual(['Daniel', 'Rachel'])
  })

  it('knows which are investments and which is the home', () => {
    expect(c.properties.filter(p => p.investor)).toHaveLength(2)
  })

  it('takes the most recent settlement across all their deals', () => {
    expect(c.lastSettled).toBe('2024-02-02')
  })

  it('treats the same address on two rows as ONE property', () => {
    const twice = groupByClient([row(), row({
      'Commission\nLoan ID(s)': '985-189326-9', 'Current\nBalance': 120000,
      'Settlement Date': new Date(2025, 2, 1), 'Security 1 value': 690000,
    })], M)[0]
    expect(twice.properties).toHaveLength(1)
    // Both loans belong to it, and the newer settlement sets the value.
    expect(twice.properties[0].loanIds).toEqual(['985-189326-4', '985-189326-9'])
    expect(twice.properties[0].valueAtSettlement).toBe(690000)
  })

  it('treats anything not called an investment as a home', () => {
    const blank = groupByClient([row({ 'Security 1 Ownership Type': '' })], M)[0]
    expect(blank.properties[0].investor).toBe(false)
  })
})

describe('what makes somebody worth opening', () => {
  const client = (over: any = {}) => groupByClient([
    row({ 'Security 1 value': 540000, 'Current\nBalance': 300000, ...over }),
  ], M)[0]

  it('is eighty per cent of the investment values less what is owed', () => {
    expect(headroom(client())).toBe(540000 * 0.8 - 300000)
  })

  it('leaves the family home out of it', () => {
    const home = client({ 'Security 1 Ownership Type': 'Owner Occupied' })
    expect(headroom(home)).toBeNull()
  })

  it('says nothing when no commission balance was matched', () => {
    // Different from zero, and the list has to keep them different: zero means
    // no equity, nothing means we cannot tell.
    expect(headroom(client({ 'Commission\nLoan ID(s)': '', 'Current\nBalance': null })))
      .toBeNull()
  })

  it('can be negative, because being past 80% is a real answer', () => {
    expect(headroom(client({ 'Current\nBalance': 500000 }))).toBeLessThan(0)
  })

  it('sorts the biggest first and the unknown last', () => {
    const big = groupByClient([row({ 'Contact - group data - full name': 'Big Fish',
      'Security 1 value': 2000000, 'Current\nBalance': 400000 })], M)[0]
    const small = groupByClient([row({ 'Contact - group data - full name': 'Small Fry',
      'Security 1 value': 500000, 'Current\nBalance': 390000 })], M)[0]
    const unknown = groupByClient([row({ 'Contact - group data - full name': 'No Match',
      'Commission\nLoan ID(s)': '', 'Current\nBalance': null })], M)[0]
    expect(worthOpeningFirst([small, unknown, big]).map(c => c.groupName))
      .toEqual(['Big Fish', 'Small Fry', 'No Match'])
  })
})

describe('what gets written to the client position', () => {
  const [c] = groupByClient([row()], M)
  const pos = positionProperties(c)

  it('is the shape docs/client-loans-view.sql already reads', () => {
    expect(pos[0]).toMatchObject({
      address: '14 Marlowe Street, Brunswick VIC 3056',
      value: '540000',
      ownershipType: 'Investment',
    })
    expect(pos[0].loans[0].lenderName).toBe('Bankwest')
    expect(pos[0].loans[0].limitAmount).toBe('432000')
  })

  it('WRITES NO BALANCE against a property', () => {
    // The de-duplicated balance is per client and cannot be split back across
    // properties - one row can cover three loans. Putting a share into each
    // would be inventing a figure. The statements carry the real one.
    expect(pos[0].loans[0].balance).toBe('')
  })

  it('gives the same client the same key every time', () => {
    expect(rowKeyFor(c)).toBe(rowKeyFor(groupByClient([row()], M)[0]))
    expect(rowKeyFor(c).startsWith('book:')).toBe(true)
  })
})

describe('the plan, before anything is written', () => {
  const book = groupByClient([
    row({ 'Contact - group data - full name': 'Daniel Whitmore, Rachel Whitmore' }),
    row({ 'Contact - group data - full name': 'Priya Venkatesan',
          'Security 1 address': '9 Tarlton Way, Preston VIC 3072' }),
    row({ 'Contact - group data - full name': 'Thomas Oyelaran',
          'Security 1 address': '3 Kinvara Place, Bulleen VIC 3105' }),
  ], M)

  const existing = [
    { id: 'c1', first_name: 'Daniel', last_name: 'Whitmore',
      book_row_key: rowKeyFor(book.find(b => b.groupName.startsWith('Daniel'))!) },
    { id: 'c2', first_name: 'Priya', last_name: 'Venkatesan', book_row_key: null },
  ]
  const plan = planTheImport(book, existing)
  const find = (n: string) => plan.find(p => p.client.groupName.startsWith(n))!

  it('recognises somebody it imported before, by key not by name', () => {
    expect(find('Daniel').decision).toBe('matched')
    expect(find('Daniel').existingId).toBe('c1')
  })

  it('offers a same-name client as a MAYBE and says why', () => {
    // Never a silent match. Emailing the wrong person is the thing this whole
    // preview exists to prevent.
    const p = find('Priya')
    expect(p.decision).toBe('maybe')
    expect(p.existingId).toBe('c2')
    expect(p.doubt).toContain('same person')
  })

  it('calls somebody the portal has never seen new', () => {
    expect(find('Thomas').decision).toBe('new')
    expect(find('Thomas').existingId).toBeUndefined()
  })

  it('counts the plan so the screen can say it in one line', () => {
    const n = countThePlan(plan)
    expect(n.all).toBe(3)
    expect(n.fresh).toBe(1)
    expect(n.matched).toBe(1)
    expect(n.maybe).toBe(1)
  })

  it('puts the biggest headroom at the top of the plan', () => {
    const hs = plan.map(p => p.headroom ?? -Infinity)
    expect([...hs].sort((a, b) => b - a)).toEqual(hs)
  })
})

describe('it decides nothing and fetches nothing', () => {
  const src = readFileSync('lib/book-import.ts', 'utf8')

  it('calls no model, no database and no clock of its own', () => {
    for (const banned of ['fetch(', 'supabase', 'anthropic', 'Date.now(', 'new Date()']) {
      expect(src, `this file must stay a function of its arguments (${banned})`)
        .not.toContain(banned)
    }
  })

  it('and never writes anything itself', () => {
    for (const banned of ['insert(', 'update(', 'upsert(', 'delete(']) {
      expect(src, `the screen writes, not this (${banned})`).not.toContain(banned)
    }
  })
})
