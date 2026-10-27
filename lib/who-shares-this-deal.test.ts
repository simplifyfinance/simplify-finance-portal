// WHO SHARES THIS DEAL.
//
// 27 Oct 2026. Fabio: "broker can seelect in Fact Find Stage what commission
// split to select so it carries accross to handover notes". And Catherine, on
// one broker writing a deal for another: "capture the right branding and the
// specific referrer, and carry both through to compliance."
import { describe, it, expect } from 'vitest'
import {
  readPct, splitFromRow, offered, termsInWords, splitInWords,
  chooseSplitPatch, splitOn, answered, sharedWithLine, termsHaveMoved,
  splitKindLabel, SPLIT_KINDS,
} from './who-shares-this-deal'

// Invented names.
const ROWS = [
  { id: 's1', name: 'Harrow Financial Planning', kind: 'referrer', who: 'Dale Harrow',
    contact_email: 'dale@harrowfp.example', upfront_pct: '20.00', trail_pct: '20.00',
    notes: 'Invoiced monthly', active: true },
  { id: 's2', name: 'Ridgeway Buyers Agents', kind: 'referrer', who: 'Tanya Ridgeway',
    upfront_pct: '25.00', trail_pct: '0.00', active: true },
  { id: 's3', name: 'Mark writes for Justin', kind: 'broker_split', who: 'Mark Gallo → Justin Cornock',
    upfront_pct: '50.00', trail_pct: '50.00', active: true },
  { id: 's4', name: 'Nolan Accounting', kind: 'referrer', upfront_pct: '15.00', trail_pct: '15.00',
    active: false },
]

describe('the list', () => {
  it('offers the ones in use, by name', () => {
    expect(offered(ROWS).map(s => s.name))
      .toEqual(['Harrow Financial Planning', 'Mark writes for Justin', 'Ridgeway Buyers Agents'])
  })

  it('and never the one that was switched off', () => {
    // Switched off, never deleted - a deal that used it has to keep making
    // sense. It just stops being offered.
    expect(offered(ROWS).some(s => s.name === 'Nolan Accounting')).toBe(false)
  })

  it('a referrer and a broker split are the same shape', () => {
    const [harrow,, ridgeway] = offered(ROWS)
    expect(harrow.kind).toBe('referrer')
    expect(offered(ROWS).find(s => s.name.startsWith('Mark'))!.kind).toBe('broker_split')
    expect(ridgeway.upfront).toBe(25)
    expect(SPLIT_KINDS).toEqual(['referrer', 'broker_split'])
    expect(splitKindLabel('broker_split')).toBe('Broker split')
  })

  it('an unrecognised kind reads as a referrer rather than breaking', () => {
    expect(splitFromRow({ id: 'x', name: 'X', kind: 'nonsense' }).kind).toBe('referrer')
  })
})

describe('a percentage', () => {
  it('reads a number out of whatever the database hands over', () => {
    expect(readPct('20.00')).toBe(20)
    expect(readPct(20)).toBe(20)
    expect(readPct('20%')).toBe(20)
    expect(readPct(12.5)).toBe(12.5)
  })

  it('and a missing one is NOT zero', () => {
    // A share nobody recorded is unknown. Written as zero it reads "they get
    // nothing", which is how a referrer ends up unpaid and nobody notices.
    expect(readPct(null)).toBeNull()
    expect(readPct('')).toBeNull()
    expect(readPct(undefined)).toBeNull()
  })

  it('but a recorded zero is an answer - upfront only, no trail', () => {
    expect(readPct(0)).toBe(0)
    expect(readPct('0.00')).toBe(0)
    expect(splitFromRow(ROWS[1]).trail).toBe(0)
  })

  it('and nonsense is refused rather than passed on', () => {
    expect(readPct('-5')).toBeNull()
    expect(readPct('250')).toBeNull()
    expect(readPct('abc')).toBeNull()
  })
})

describe('saying it in words', () => {
  it('both shares', () => {
    expect(termsInWords(20, 20)).toBe('20% upfront, 20% trail')
  })

  it('a zero trail is said out loud, because it is a real arrangement', () => {
    expect(termsInWords(25, 0)).toBe('25% upfront, 0% trail')
  })

  it('and where nothing is recorded it says so rather than inventing nought', () => {
    expect(termsInWords(null, null)).toBe('share not recorded')
    expect(termsInWords(20, null)).toBe('20% upfront')
  })

  it('the dropdown line names it, says which kind, and gives the terms', () => {
    expect(splitInWords(splitFromRow(ROWS[0])))
      .toBe('Harrow Financial Planning — referrer · 20% upfront, 20% trail')
  })
})

describe('what gets written onto the deal', () => {
  const now = new Date('2026-10-27T09:00:00+11:00')
  const patch = chooseSplitPatch(splitFromRow(ROWS[0]), 'Mark Gallo', now)

  it('the terms are COPIED, not pointed at', () => {
    expect(patch.commission_split_id).toBe('s1')
    expect(patch.commission_split_name).toBe('Harrow Financial Planning')
    expect(patch.commission_split_upfront).toBe(20)
    expect(patch.commission_split_trail).toBe(20)
  })

  it('and who chose it, and when', () => {
    expect(patch.commission_split_by).toBe('Mark Gallo')
    expect(patch.commission_split_at).toBe(now.toISOString())
  })

  it('"nobody" is written down as an answer, not left blank', () => {
    const none = chooseSplitPatch(null, 'Mark Gallo', now)
    expect(none.commission_split_none).toBe(true)
    expect(none.commission_split_id).toBeNull()
    expect(none.commission_split_at).toBe(now.toISOString())
  })
})

describe('reading it back off the deal', () => {
  const deal = { ...chooseSplitPatch(splitFromRow(ROWS[0]), 'Mark Gallo', new Date('2026-10-27T09:00:00+11:00')) }

  it('says who and on what terms', () => {
    expect(sharedWithLine(deal))
      .toBe('Harrow Financial Planning — referrer, 20% upfront, 20% trail')
    expect(splitOn(deal)?.by).toBe('Mark Gallo')
    expect(answered(deal)).toBe(true)
  })

  it('a deal answered "nobody" says so plainly', () => {
    const none = chooseSplitPatch(null, 'Mark Gallo', new Date())
    expect(sharedWithLine(none)).toBe('Not shared — this one is all ours')
    expect(splitOn(none)?.none).toBe(true)
    expect(answered(none)).toBe(true)
  })

  it('AND A DEAL NOBODY HAS BEEN ASKED IS A THIRD THING', () => {
    // The whole reason commission_split_none exists. "All ours" and "nobody
    // has checked" look identical in a blank column, and compliance has to be
    // able to tell them apart.
    expect(splitOn({ id: 'd1' })).toBeNull()
    expect(answered({ id: 'd1' })).toBe(false)
    expect(sharedWithLine({ id: 'd1' }))
      .toBe('Not recorded — nobody has said whether this deal is shared')
  })

  it('a broker split reads as one', () => {
    const d = chooseSplitPatch(splitFromRow(ROWS[2]), 'Mark Gallo', new Date())
    expect(sharedWithLine(d)).toBe('Mark writes for Justin — broker split, 50% upfront, 50% trail')
  })
})

describe('when the arrangement is renegotiated afterwards', () => {
  const deal = chooseSplitPatch(splitFromRow(ROWS[0]), 'Mark Gallo', new Date('2026-10-27T09:00:00+11:00'))

  it('the deal keeps what was agreed on the day', () => {
    const later = [{ ...ROWS[0], upfront_pct: '25.00', trail_pct: '25.00' }]
    expect(splitOn(deal)?.upfront).toBe(20)
    expect(sharedWithLine(deal)).toContain('20% upfront')
    // A settled deal must never start claiming a share nobody agreed to.
    expect(sharedWithLine({ ...deal, ...{} })).not.toContain('25%')
    expect(later[0].upfront_pct).toBe('25.00')
  })

  it('but it says so, rather than quietly disagreeing with Settings', () => {
    const later = [{ ...ROWS[0], upfront_pct: '25.00', trail_pct: '25.00' }]
    const msg = termsHaveMoved(deal, later)
    expect(msg).toContain('agreed at 20% upfront, 20% trail')
    expect(msg).toContain('now set to 25% upfront, 25% trail')
    expect(msg).toContain('keeps what was agreed')
  })

  it('and says nothing where nothing has moved', () => {
    expect(termsHaveMoved(deal, ROWS)).toBe('')
  })

  it('or where the arrangement has been taken off the list entirely', () => {
    // The deal still reads correctly off its own copy. There is nothing to
    // compare it with, so there is nothing to say.
    expect(termsHaveMoved(deal, [])).toBe('')
  })

  it('and never on a deal answered "nobody"', () => {
    expect(termsHaveMoved(chooseSplitPatch(null, 'Mark', new Date()), ROWS)).toBe('')
  })
})
