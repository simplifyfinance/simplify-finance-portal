// LOOKING AT SOMEBODY ELSE'S TODAY.
//
// 12 Nov 2026. Fabio, approving mock-ups of screens he could not open: "I cant
// see credit and broker how do I know what it looks like."
//
// And, in the same breath, the rule that matters most here:
//
//   "the view as I dont want everyone to have it just me."
//
// So these tests are mostly about who CANNOT do this. An admin seeing every
// deal is the business working. An admin opening a colleague's own morning
// plan is not, and nobody asked for it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  mayViewAs, lookingAt, isSomebodyElse, grouped, viewingLine, MAY_VIEW_AS,
  type Somebody,
} from './view-as'

const ME = '8696747e-db8c-4e3e-867f-c7cde47d8a64'
const HER = '1c45a007-a8f7-4945-a65a-f8856547b279'

describe('who may look', () => {
  it('Fabio', () => {
    expect(mayViewAs('fabio@simplifyfinance.com.au')).toBe(true)
  })

  it('and however he types his own address', () => {
    expect(mayViewAs('Fabio@SimplifyFinance.com.au')).toBe(true)
    expect(mayViewAs('  fabio@simplifyfinance.com.au  ')).toBe(true)
  })

  // THE WHOLE POINT. These four are admins and see every deal in the business.
  // They still do not get this.
  it('and nobody else, including the other admins', () => {
    for (const who of ['mark@simplifyfinance.com.au', 'kylie@simplifyfinance.com.au',
                       'catherine@simplifyfinance.com.au', 'katie@simplifyfinance.com.au']) {
      expect(mayViewAs(who), `${who} must not be able to view as`).toBe(false)
    }
  })

  it('and not an empty one', () => {
    for (const nothing of ['', null, undefined, '   ', 0, {}]) {
      expect(mayViewAs(nothing as any)).toBe(false)
    }
  })

  it('the list is short and deliberate', () => {
    expect(MAY_VIEW_AS).toHaveLength(1)
  })
})

describe('whose day is being looked at', () => {
  it('nobody, when the person may not look', () => {
    expect(lookingAt(HER, false)).toBe(null)
  })

  it('the one in the address bar, when they may', () => {
    expect(lookingAt(HER, true)).toBe(HER)
  })

  it('and nothing at all when there is nothing there', () => {
    expect(lookingAt('', true)).toBe(null)
    expect(lookingAt(null, true)).toBe(null)
  })

  // AN ID ARRIVES FROM A DROPDOWN WE DREW. Anything else is somebody typing in
  // the address bar, and it is not passed to the database.
  it('and anything that is not a plain id is read as nothing', () => {
    for (const junk of ['1 or 1=1', '../admin', 'katie', HER + "'", '<script>']) {
      expect(lookingAt(junk, true), junk).toBe(null)
    }
  })
})

describe('looking at your own day is not viewing as', () => {
  it('however the URL is written', () => {
    expect(isSomebodyElse(ME, ME)).toBe(false)
    expect(isSomebodyElse(null, ME)).toBe(false)
  })

  it('and somebody else is', () => {
    expect(isSomebodyElse(HER, ME)).toBe(true)
  })
})

describe('the picker', () => {
  const people: Somebody[] = [
    { id: '1', name: 'Mellissa Sedin', seat: 'credit', group: 'Credit' },
    { id: '2', name: 'Katie Amos', seat: 'credit', group: 'Credit' },
    { id: '3', name: 'Keanen Wood', seat: 'broker', group: 'Simplify Finance Brokers' },
    { id: '4', name: 'Catherine McFarlane', seat: 'staff', group: 'Settlements' },
  ]

  it('keeps the business\'s own order of groups', () => {
    expect(grouped(people).map(g => g.group))
      .toEqual(['Credit', 'Simplify Finance Brokers', 'Settlements'])
  })

  // NOT BY WORKLOAD. A list that reshuffles itself as the week moves is a list
  // you have to read every time instead of reaching for.
  it('and sorts people by name inside each one', () => {
    expect(grouped(people)[0].people.map(p => p.name))
      .toEqual(['Katie Amos', 'Mellissa Sedin'])
  })

  it('and says nothing when there is nobody', () => {
    expect(grouped([])).toEqual([])
  })
})

describe('the strip at the top', () => {
  it('says who, that nothing saves, and that they are not told', () => {
    const line = viewingLine(
      { id: '2', name: 'Katie Amos', seat: 'credit', group: 'Credit' })
    expect(line).toContain('Katie Amos')
    expect(line).toContain('credit')
    expect(line).toContain('Nothing here saves')
    expect(line).toContain('not told')
  })

  it('and says nothing at all when you are looking at your own', () => {
    expect(viewingLine(null)).toBe('')
  })
})

// SHE IS NOT TOLD, AND NOTHING IS WRITTEN. If this file ever starts recording
// who looked at whom, it has become something nobody asked for.
describe('it leaves no trace', () => {
  const src = readFileSync('lib/view-as.ts', 'utf8')

  it('writes nothing to the database', () => {
    expect(src).not.toContain('supabase')
    expect(src).not.toContain('insert')
    expect(src).not.toContain('update')
  })
})
