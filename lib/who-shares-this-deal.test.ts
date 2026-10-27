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
  lineFrom, blankLine, totalsOf, addsUpWarning, linesInWords,
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

// AN ARRANGEMENT WRITTEN THE NEW WAY. Three parties, which the old shape - one
// pair of percentages - could not describe at all.
const THREE = {
  id: 's5', name: 'Harrow referral', kind: 'referrer', active: true,
  lines: [
    { who: 'Simplify Finance', upfront: 20, trail: 20 },
    { who: 'Harrow Financial Planning', upfront: 20, trail: 20 },
    { who: 'Mark Gallo', upfront: 60, trail: 60 },
  ],
}

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

  it('the dropdown line names it and gives the breakdown', () => {
    expect(splitInWords(splitFromRow(THREE)))
      .toBe('Harrow referral — Simplify Finance 20% · Harrow Financial Planning 20% · Mark Gallo 60%')
  })

  it('and a row written before lines existed reads as one line', () => {
    expect(splitInWords(splitFromRow(ROWS[0])))
      .toBe('Harrow Financial Planning — Dale Harrow 20%')
  })
})

// A SPLIT IS A LIST OF LINES.
//
// 27 Oct 2026, hours after the first version shipped. Fabio: "we need the
// ability of addint lines for upfront and trail so line one for exmaple 20%
// simplify line 80% broker 1 and abilty to add third line".
//
// He was right and the first shape was wrong. One pair of percentages can only
// say what ONE party gets - "the referrer takes 20%" and nothing about who
// holds the other eighty. The house, the referrer and the writing broker all
// taking a share is the normal case, not the edge one.
describe('a line', () => {
  it('is a name and two shares', () => {
    expect(lineFrom({ who: ' Dale Harrow ', upfront: '20%', trail: '20.00' }))
      .toEqual({ who: 'Dale Harrow', upfront: 20, trail: 20 })
  })

  it('and upfront and trail are set SEPARATELY, because they differ', () => {
    // A referrer on the upfront only, taking nothing of the trail, is a real
    // arrangement. The old shape could not write it down.
    expect(lineFrom({ who: 'Ridgeway', upfront: 25, trail: 0 }).trail).toBe(0)
    expect(linesInWords([{ who: 'Ridgeway', upfront: 25, trail: 0 }]))
      .toBe('Ridgeway 25% upfront, 0% trail')
  })

  it('a blank one is empty, not zero', () => {
    expect(blankLine()).toEqual({ who: '', upfront: null, trail: null })
  })

  it('where both shares match it is said once', () => {
    expect(linesInWords([{ who: 'Harrow', upfront: 20, trail: 20 }])).toBe('Harrow 20%')
  })

  it('but an unrecorded trail does NOT read like a matching one', () => {
    // 20% upfront with the trail left empty and 20% on both used to print the
    // same five characters. They are different arrangements.
    expect(linesInWords([{ who: 'Harrow', upfront: 20, trail: null }])).toBe('Harrow 20% upfront')
  })

  it('and a line nobody has filled in says so rather than inventing a share', () => {
    expect(linesInWords([{ who: 'Harrow', upfront: null, trail: null }]))
      .toBe('Harrow share not recorded')
    expect(linesInWords([{ who: '', upfront: 25, trail: 25 }])).toBe('share not recorded')
    expect(linesInWords([])).toBe('share not recorded')
  })
})

describe('does it add up', () => {
  it('three lines to a hundred', () => {
    expect(totalsOf(splitFromRow(THREE).lines))
      .toEqual({ upfront: 100, trail: 100, upfrontOk: true, trailOk: true })
  })

  it('and a column that does not is a WARNING, not a refusal', () => {
    // A screen that will not save until the numbers are tidy is a screen
    // people work around. It says so and saves anyway.
    const short = [{ who: 'Simplify', upfront: 75, trail: 100 }, { who: 'Ridgeway', upfront: 15, trail: null }]
    expect(totalsOf(short).upfrontOk).toBe(false)
    expect(addsUpWarning(short)).toContain('Upfront adds up to 90%, not 100%')
    expect(addsUpWarning(short)).toContain('Saved anyway')
  })

  it('and says nothing at all where both columns are right', () => {
    expect(addsUpWarning(splitFromRow(THREE).lines)).toBe('')
  })

  it('an empty line counts as nothing, not as a zero that drags the total down', () => {
    expect(totalsOf([{ who: 'Simplify', upfront: 100, trail: 100 }, blankLine()]).upfrontOk).toBe(true)
  })
})

describe('nothing already set has to be retyped', () => {
  it('a row with no lines is read as a single line off the old columns', () => {
    expect(splitFromRow(ROWS[0]).lines).toEqual([{ who: 'Dale Harrow', upfront: 20, trail: 20 }])
  })

  it('and where nobody was named, the arrangement name stands in', () => {
    expect(splitFromRow(ROWS[3]).lines).toEqual([{ who: 'Nolan Accounting', upfront: 15, trail: 15 }])
  })

  it('an empty row still holds one line, so the table is never blank', () => {
    // An empty table reads as a broken screen rather than as a choice.
    expect(splitFromRow({ id: 'z', name: 'Z' }).lines).toEqual([blankLine()])
  })

  it('and the old columns are still written, so nothing older breaks', () => {
    expect(splitFromRow(ROWS[0]).upfront).toBe(20)
    expect(splitFromRow(ROWS[0]).trail).toBe(20)
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

  it('and so is the WHOLE breakdown, every line of it', () => {
    // Renegotiating an arrangement next year must not rewrite what a settled
    // deal says was agreed at the time.
    const three = chooseSplitPatch(splitFromRow(THREE), 'Mark Gallo', now)
    expect(three.commission_split_lines).toEqual([
      { who: 'Simplify Finance', upfront: 20, trail: 20 },
      { who: 'Harrow Financial Planning', upfront: 20, trail: 20 },
      { who: 'Mark Gallo', upfront: 60, trail: 60 },
    ])
  })

  it('and "nobody" clears the lines as well', () => {
    expect(chooseSplitPatch(null, 'Mark Gallo', now).commission_split_lines).toBeNull()
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
      .toBe('Harrow Financial Planning — referrer · Dale Harrow 20%')
    expect(splitOn(deal)?.by).toBe('Mark Gallo')
    expect(answered(deal)).toBe(true)
  })

  it('and every party on a three-way split, not just one of them', () => {
    const three = chooseSplitPatch(splitFromRow(THREE), 'Mark Gallo', new Date())
    expect(sharedWithLine(three)).toBe(
      'Harrow referral — referrer · Simplify Finance 20% · Harrow Financial Planning 20% · Mark Gallo 60%')
  })

  it('a deal settled before lines existed still reads off its own copy', () => {
    // No commission_split_lines column on it at all. It must not read as empty.
    const old = { commission_split_id: 's1', commission_split_name: 'Harrow Financial Planning',
      commission_split_kind: 'referrer', commission_split_upfront: 20, commission_split_trail: 20,
      commission_split_by: 'Mark Gallo', commission_split_at: new Date().toISOString() }
    expect(splitOn(old)?.lines).toEqual([{ who: 'Harrow Financial Planning', upfront: 20, trail: 20 }])
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
    expect(sharedWithLine(d)).toBe('Mark writes for Justin — broker split · Mark Gallo → Justin Cornock 50%')
  })
})

describe('when the arrangement is renegotiated afterwards', () => {
  const deal = chooseSplitPatch(splitFromRow(ROWS[0]), 'Mark Gallo', new Date('2026-10-27T09:00:00+11:00'))

  it('the deal keeps what was agreed on the day', () => {
    const later = [{ ...ROWS[0], upfront_pct: '25.00', trail_pct: '25.00' }]
    expect(splitOn(deal)?.upfront).toBe(20)
    expect(sharedWithLine(deal)).toContain('Dale Harrow 20%')
    // A settled deal must never start claiming a share nobody agreed to.
    expect(sharedWithLine({ ...deal, ...{} })).not.toContain('25%')
    expect(later[0].upfront_pct).toBe('25.00')
  })

  it('but it says so, rather than quietly disagreeing with Settings', () => {
    const later = [{ ...ROWS[0], upfront_pct: '25.00', trail_pct: '25.00' }]
    const msg = termsHaveMoved(deal, later)
    expect(msg).toContain('agreed at Dale Harrow 20%')
    expect(msg).toContain('now set to Dale Harrow 25%')
    expect(msg).toContain('keeps what was agreed')
  })

  it('and says nothing where nothing has moved', () => {
    expect(termsHaveMoved(deal, ROWS)).toBe('')
  })

  it('it notices a line being ADDED, not only a percentage changing', () => {
    // The old check compared one pair of numbers, so a third party joining an
    // arrangement was invisible. That is the change most worth saying.
    const grew = [{ ...ROWS[0], lines: [{ who: 'Dale Harrow', upfront: 20, trail: 20 },
      { who: 'Mark Gallo', upfront: 80, trail: 80 }] }]
    expect(termsHaveMoved(deal, grew)).toContain('now set to Dale Harrow 20% · Mark Gallo 80%')
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
