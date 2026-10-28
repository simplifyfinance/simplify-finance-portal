import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { rowsFor, withReceived, withUnreceived, withTick, withRequest, type DocItem } from './document-progress'
import { stillOut, cameIn, daysWaiting, isLate, SHOUT_AFTER_DAYS } from './documents-outstanding'

// A DOCUMENT THAT CAME BACK.
//
// 28 Oct 2026. Until today this portal could say what it had ASKED a client
// for, and nothing else. Four documents back out of eight looked exactly like
// none back out of eight, on every screen and in every email.
//
// Fabio: "once we have those documents, do we manually mark them as we have?...
// Chris has to come back into the portal and start ticking them off."
//
// WHY THIS IS TESTED HARD. The list produced here is the list that goes into a
// client's email. Get it wrong in one direction and we chase somebody for a
// payslip they sent a fortnight ago; get it wrong in the other and a file goes
// to a lender with a hole in it that everybody believed was filled.

const BOX = readFileSync(join(__dirname, '..', 'components', 'DocumentsBox.tsx'), 'utf8')

const item = (key: string, label: string): DocItem => ({
  key, label, group: 'income' as any, groupKey: 'income', groupLabel: 'Income',
  forWhat: 'lodge', round: 'proceed', auto: true, why: '',
} as any)

const ITEMS = [item('payslips', 'Two most recent payslips'),
               item('payg', 'PAYG summary'),
               item('rates', 'Council rates notice')]

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

/** Ticked and asked for `days` ago. */
const asked = (keys: string[], days: number) =>
  withRequest({}, keys, 'Kylie', ago(days))

describe('SAYING A DOCUMENT TURNED UP', () => {
  it('records who said so and when', () => {
    const p = withReceived({}, 'payslips', 'Cris')
    expect(p.received?.payslips?.by).toBe('Cris')
    expect(p.received?.payslips?.at).toBeTruthy()
  })

  it('AND IT CAN BE TAKEN BACK', () => {
    // Somebody will press the wrong row. A tick nobody dares undo is a tick
    // nobody uses, and a document wrongly marked in is never chased again.
    const p = withUnreceived(withReceived({}, 'payslips', 'Cris'), 'payslips')
    expect(p.received?.payslips).toBeUndefined()
  })

  it('and it never touches the other decisions', () => {
    const p = withReceived(withTick({}, 'payg', false, 'Kylie'), 'payslips', 'Cris')
    expect(p.decisions?.payg?.ticked).toBe(false)
    expect(p.received?.payslips).toBeTruthy()
  })

  it('and an empty key changes nothing', () => {
    expect(withReceived({}, '', 'Cris').received).toBeUndefined()
  })

  it('and the row carries it through', () => {
    const p = withReceived(asked(['payslips'], 2), 'payslips', 'Cris')
    const row = rowsFor(ITEMS, p).find(r => r.key === 'payslips')!
    expect(row.receivedAt).toBeTruthy()
    expect(row.receivedBy).toBe('Cris')
  })
})

describe('WHAT IS STILL OUT', () => {
  const ticked = (p: any) => ({
    ...p,
    decisions: Object.fromEntries(ITEMS.map(i => [i.key, { ticked: true, at: '', by: 'Kylie' }])),
  })

  it('asked for and not here', () => {
    const rows = rowsFor(ITEMS, ticked(asked(['payslips', 'payg', 'rates'], 3)))
    expect(stillOut(rows).map(r => r.key)).toEqual(['payslips', 'payg', 'rates'])
  })

  it('and one that came in drops off', () => {
    const p = withReceived(ticked(asked(['payslips', 'payg', 'rates'], 3)), 'payg', 'Cris')
    const rows = rowsFor(ITEMS, p)
    expect(stillOut(rows).map(r => r.key)).toEqual(['payslips', 'rates'])
    expect(cameIn(rows).map(r => r.key)).toEqual(['payg'])
  })

  it('A ROW NOBODY ASKED FOR IS NOT OUTSTANDING', () => {
    // The list goes in a client's email. Chasing somebody for a document they
    // were never asked for is how a client learns the list is not to be
    // trusted, and the next real chase gets ignored with it.
    const rows = rowsFor(ITEMS, ticked({}))
    expect(stillOut(rows)).toHaveLength(0)
  })

  it('and an unticked row is not outstanding either', () => {
    const p = { ...asked(['payslips'], 3), decisions: { payslips: { ticked: false, at: '', by: 'Kylie' } } }
    expect(stillOut(rowsFor(ITEMS, p))).toHaveLength(0)
  })

  it('and everything in means nothing out, which is the usual deal', () => {
    let p: any = ticked(asked(['payslips', 'payg', 'rates'], 3))
    for (const k of ['payslips', 'payg', 'rates']) p = withReceived(p, k, 'Cris')
    expect(stillOut(rowsFor(ITEMS, p))).toHaveLength(0)
    expect(cameIn(rowsFor(ITEMS, p))).toHaveLength(3)
  })
})

describe('HOW LONG IT HAS BEEN WAITING', () => {
  const rowAfter = (days: number) => rowsFor(ITEMS, {
    ...asked(['payslips'], days),
    decisions: { payslips: { ticked: true, at: '', by: 'Kylie' } },
  }).find(r => r.key === 'payslips')!

  it('counts whole days from when it was asked for', () => {
    expect(daysWaiting(rowAfter(0))).toBe(0)
    expect(daysWaiting(rowAfter(7))).toBe(7)
    expect(daysWaiting(rowAfter(21))).toBe(21)
  })

  it('AND FOURTEEN IS THE DAY IT STARTS SHOUTING, NOT FIFTEEN', () => {
    // Fabio: "still waiting after 14 days. Yeah, should be shouting after that."
    expect(SHOUT_AFTER_DAYS).toBe(14)
    expect(isLate(rowAfter(13))).toBe(false)
    expect(isLate(rowAfter(14))).toBe(true)
    expect(isLate(rowAfter(40))).toBe(true)
  })

  it('and a row never asked for has no age and is never late', () => {
    const row = rowsFor(ITEMS, {}).find(r => r.key === 'payslips')!
    expect(daysWaiting(row)).toBeNull()
    expect(isLate(row)).toBe(false)
  })

  it('and a nonsense date is not a number of days', () => {
    expect(daysWaiting({ requestedAt: 'soon' } as any)).toBeNull()
    expect(daysWaiting({ requestedAt: '' } as any)).toBeNull()
  })
})

describe('THE BOX ON SCREEN', () => {
  it('A ROW CALLED RECEIVED NOW COUNTS WHAT CAME BACK', () => {
    // It said "Received" and printed tickedCount - how many WE decided to ask
    // for - from the day it was built. A wrong number labelled honestly gets
    // questioned; a wrong number labelled "Received" gets believed.
    expect(BOX).toContain('{inNow.length}')
    expect(BOX).not.toMatch(/Received<\/dt>\s*\n\s*<dd[^>]*>\{ticked\}/)
  })

  it('and there is a Still out count beside it', () => {
    expect(BOX).toContain('Still out')
    expect(BOX).toContain('{out.length}')
  })

  it('and every asked-for row has an Arrived button', () => {
    expect(BOX).toContain('Arrived')
    expect(BOX).toContain('withReceived(cur, r.key, who)')
    expect(BOX).toContain('withUnreceived(cur, r.key)')
  })

  it('AND NOBODY IS LOCKED OUT OF PRESSING IT', () => {
    // Fabio: "who ticks is Chris and credit. So allow everyone to tick this."
    // The person who can see the document is the person who should record it.
    const arrived = BOX.slice(BOX.indexOf('ARRIVED. Only on a row'), BOX.indexOf('Arrived\n'))
    expect(arrived).not.toContain('can(')
    expect(arrived).not.toContain('userRole')
  })

  it('and the left tick only goes green once it is actually here', () => {
    // It used to go green the moment the email left, which is how a box of
    // eight green ticks could mean nothing had arrived.
    expect(BOX).toContain('r.receivedAt ? \'bg-done-bg border-done-edge text-done\'')
  })
})
