import { describe, it, expect } from 'vitest'
import {
  NO_NOTICE, readNotice, announcedFrom, hasTakenEffect, noticeFor, stillCarrying,
  allPassedOn, notAnnounced, comingUp, loadTheseRatesLine, nextDecisionWarning,
  daysOn, isOverdue, nagLine, defaultReviewBy, forNextDecision, niceDate, REVIEW_DAYS,
  noticeForMany, appliesToLine,
  type RateNotice,
} from './rate-notice'

// A DISCLAIMER IS A CLAIM, AND A WRONG ONE IS WORSE THAN A MISSING ONE.
//
// Every test here is about one of two failures: a client told a rate does not
// include an increase that it already includes, or a client told nothing while
// their bank has not moved yet.

const NOTICE: RateNotice = {
  on: true,
  text: 'Please note, the rates quoted above do not factor in the recent RBA rate increase of 0.25%.',
  decisionDate: '2026-09-30',
  reviewBy: '2026-10-21',
}

// A lender that has announced: which decision it answers, and the day it starts.
const lender = (name: string, from?: string, forDecision = '2026-09-30') => ({
  id: name.toLowerCase(), name,
  rate_notice_for: from ? forDecision : null,
  rate_notice_from: from ?? null,
  rate_notice_by: from ? 'Katie Amos' : null,
  rate_notice_at: from ? '2026-10-02T00:00:00Z' : null,
})

const on = (d: string) => new Date(d + 'T09:00:00Z')

// Two already in force, one announced but not yet started, two silent.
const PANEL = [
  lender('Bankwest', '2026-10-07'),
  lender('CBA', '2026-10-09'),
  lender('Macquarie Bank', '2026-10-21'),
  lender('ANZ'),
  lender('ubank'),
]
const AFTER_CBA = on('2026-10-12')

describe('the notice runs until that bank\u2019s date, then stops by itself', () => {
  // FABIO'S OWN EXAMPLE, 30 Sep 2026: Macquarie announce on the 30th that their
  // increase starts on 21 October. Every Macquarie email carries the notice up
  // to the 21st and none carries it from the 21st, with nobody touching it.
  const macq = lender('Macquarie Bank', '2026-10-21')

  it('carries it the day before', () => {
    expect(noticeFor(macq, NOTICE, on('2026-10-20'))).toContain('0.25%')
  })

  it('and stops on the day itself, not the day after', () => {
    // The rate that takes effect on the 21st IS the rate being quoted on the
    // 21st, so a notice still running that morning is already wrong.
    expect(noticeFor(macq, NOTICE, on('2026-10-21'))).toBe('')
    expect(noticeFor(macq, NOTICE, on('2026-10-22'))).toBe('')
  })

  it('with nobody having to touch anything on the day', () => {
    // Same record, two different days, two different answers.
    expect(hasTakenEffect(macq, NOTICE, on('2026-10-20'))).toBe(false)
    expect(hasTakenEffect(macq, NOTICE, on('2026-10-21'))).toBe(true)
  })

  it('a bank that has announced nothing keeps carrying it, with no end in sight', () => {
    expect(announcedFrom(lender('ANZ'), NOTICE)).toBe('')
    expect(noticeFor(lender('ANZ'), NOTICE, on('2027-01-01'))).toContain('0.25%')
  })

  it('nobody at all when it is off', () => {
    expect(noticeFor(lender('ANZ'), { ...NOTICE, on: false })).toBe('')
  })

  it('and nobody when there are no words to say', () => {
    expect(noticeFor(lender('ANZ'), readNotice({ ...NOTICE, text: '' }))).toBe('')
  })

  it('an unknown lender is treated as not having moved', () => {
    // The safe direction. A deal with no lender loaded yet must warn rather
    // than stay silent.
    expect(noticeFor(null, NOTICE)).toContain('0.25%')
    expect(noticeFor({}, NOTICE)).toContain('0.25%')
  })
})

describe('a date belongs to the decision it answers', () => {
  // THE TWO-MONTH QUESTION. Fabio, 30 Sep 2026: "think abaout how we do that
  // agin in 2 months tiems".
  it('a date given for the last decision counts for nothing against this one', () => {
    const old = lender('ANZ', '2026-08-20', '2026-08-05')
    expect(announcedFrom(old, NOTICE)).toBe('')
    expect(noticeFor(old, NOTICE, on('2026-10-01'))).toContain('0.25%')
  })

  it('so changing the decision date puts every bank back on the notice', () => {
    const next = forNextDecision(NOTICE, '2026-12-02')
    for (const l of PANEL) {
      expect(announcedFrom(l, next), `${l.name} carried its old date across`).toBe('')
      expect(noticeFor(l, next, on('2026-12-03'))).toBeTruthy()
    }
  })

  it('and there is nothing to clear down, so nothing to half-finish', () => {
    const next = forNextDecision(NOTICE, '2026-12-02', 'a cut of 0.25%')
    expect(next.text).toBe('a cut of 0.25%')
    expect(next.decisionDate).toBe('2026-12-02')
    expect(next.reviewBy).toBe('2026-12-23')
    expect(next.on).toBe(true)
  })

  it('keeps the old words when no new ones are given', () => {
    expect(forNextDecision(NOTICE, '2026-12-02').text).toBe(NOTICE.text)
  })

  it('says what changing it will do before anybody does it', () => {
    const w = nextDecisionWarning(PANEL, NOTICE)
    expect(w).toContain('All 5 lenders')
    expect(w).toContain('3 dates')
  })
})

describe('what is still out there', () => {
  it('names who is still carrying it on a given day', () => {
    // On 12 October: Bankwest and CBA have started, the rest have not.
    expect(stillCarrying(PANEL, NOTICE, AFTER_CBA)).toEqual(['Macquarie Bank', 'ANZ', 'ubank'])
  })

  // A DIFFERENT LIST, AND THE ONE WORTH CHASING. A bank with a date is handled;
  // a bank with no date is a phone call.
  it('separates the ones that have told us nothing', () => {
    expect(notAnnounced(PANEL, NOTICE)).toEqual(['ANZ', 'ubank'])
  })

  it('says nothing when the notice is off', () => {
    expect(stillCarrying(PANEL, { ...NOTICE, on: false })).toEqual([])
    expect(notAnnounced(PANEL, { ...NOTICE, on: false })).toEqual([])
  })

  it('knows when every bank has been through', () => {
    expect(allPassedOn(PANEL, NOTICE, AFTER_CBA)).toBe(false)
    expect(allPassedOn(PANEL, NOTICE, on('2026-10-22'))).toBe(false) // ANZ and ubank never announced
    expect(allPassedOn(PANEL.slice(0, 3), NOTICE, on('2026-10-22'))).toBe(true)
  })

  it('an empty panel is not "everybody has been through"', () => {
    expect(allPassedOn([], NOTICE)).toBe(false)
    expect(allPassedOn(null, NOTICE)).toBe(false)
  })
})

describe('the switch-off cannot leave a stale rate uncaveated', () => {
  // THE RISK THE DATE CREATES. The notice comes off Macquarie on 21 October
  // whether or not anybody loaded Macquarie's new rates - so the portal has to
  // say so beforehand, or it would vanish on the morning nobody was watching.
  it('names whose rates are due within a few days', () => {
    expect(comingUp(PANEL, NOTICE, on('2026-10-19')).map(x => x.name)).toEqual(['Macquarie Bank'])
  })

  it('says it in words, with the date', () => {
    const line = loadTheseRatesLine(PANEL, NOTICE, on('2026-10-19'))
    expect(line).toContain('Macquarie Bank on 21 October')
    expect(line).toContain('whether the rates are in or not')
  })

  it('says nothing when nothing is due', () => {
    expect(loadTheseRatesLine(PANEL, NOTICE, on('2026-10-14'))).toBe('')
  })

  it('and nothing about a date that has already been and gone', () => {
    expect(comingUp(PANEL, NOTICE, on('2026-10-25'))).toEqual([])
  })
})

describe('it cannot be quietly forgotten', () => {
  it('is not overdue before the review date', () => {
    expect(isOverdue(NOTICE, on('2026-10-20'))).toBe(false)
    expect(nagLine(NOTICE, PANEL, on('2026-10-20'))).toBe('')
  })

  it('is overdue after it', () => {
    expect(isOverdue(NOTICE, on('2026-10-24'))).toBe(true)
  })

  it('an off notice is never overdue', () => {
    expect(isOverdue({ ...NOTICE, on: false }, on('2027-03-01'))).toBe(false)
  })

  it('counts the days from the decision', () => {
    expect(daysOn(NOTICE, on('2026-10-24'))).toBe(24)
  })

  // IT CHASES THE BANKS THAT HAVE SAID NOTHING, not the ones with a date. A
  // bank with a date is finishing by itself and is nobody's problem.
  it('names only the banks that have told us nothing', () => {
    const line = nagLine(NOTICE, PANEL, on('2026-10-24'))
    expect(line).toContain('24 days')
    expect(line).toContain('ANZ and ubank')
    expect(line).not.toContain('Macquarie')
    expect(line).toContain('30 September')
  })

  it('says so plainly when every bank has a date and it is just running out', () => {
    const line = nagLine(NOTICE, PANEL.slice(0, 3), on('2026-10-24'))
    expect(line).toContain('finishing by itself')
  })

  it('handles one bank without reading like a robot', () => {
    const line = nagLine(NOTICE, [lender('ANZ')], on('2026-10-24'))
    expect(line).toContain('ANZ has still not told us')
    expect(line).toContain('Chase them')
  })
})

describe('several lenders on one email', () => {
  const three = (a?: string, b?: string, c?: string) =>
    [lender('ANZ', a), lender('Bankwest', b), lender('Macquarie Bank', c)]
  const day = (d: string) => new Date(d + 'T09:00:00Z')

  it('shows nothing once every option is in force', () => {
    const out = noticeForMany(three('2026-10-01', '2026-10-01', '2026-10-01'), NOTICE, day('2026-10-05'))
    expect(out.text).toBe('')
    expect(out.appliesTo).toEqual([])
  })

  it('shows the notice plainly when none of them has', () => {
    const out = noticeForMany(three(), NOTICE)
    expect(out.text).toContain('0.25%')
    // Nothing to single out - it is true of the whole page.
    expect(out.appliesTo).toEqual([])
    expect(appliesToLine(out.appliesTo)).toBe('')
  })

  // THE CASE THAT MATTERS, and the one a single switch gets wrong.
  it('names the ones it applies to when only some have moved', () => {
    const out = noticeForMany(three(undefined, '2026-10-01', undefined), NOTICE, day('2026-10-05'))
    expect(out.text).toContain('0.25%')
    expect(out.appliesTo).toEqual(['ANZ', 'Macquarie Bank'])
    expect(appliesToLine(out.appliesTo))
      .toBe('This applies to the rates quoted for ANZ and Macquarie Bank.')
  })

  it('reads properly for one lender', () => {
    const out = noticeForMany(three('2026-10-01', '2026-10-01', undefined), NOTICE, day('2026-10-05'))
    expect(appliesToLine(out.appliesTo))
      .toBe('This applies to the rate quoted for Macquarie Bank.')
  })

  // A BORROWING CAPACITY HAS NO LENDER YET. Nobody has passed anything on, so
  // the notice stands exactly as written.
  it('stands as written when no lender is named at all', () => {
    const out = noticeForMany([], NOTICE)
    expect(out.text).toContain('0.25%')
    expect(out.appliesTo).toEqual([])
    expect(noticeForMany(null, NOTICE).text).toContain('0.25%')
  })

  it('says nothing at all when the notice is off', () => {
    expect(noticeForMany(three(), { ...NOTICE, on: false }).text).toBe('')
  })
})

// ---------------------------------------------------------------------------
// THE DAY IS A SYDNEY DAY.
//
// 9 Oct 2026, found in an audit. startOfDay() read the UTC date and the server
// runs in UTC, so for the first ten or eleven hours of every Australian working
// day the code still thought it was yesterday and kept adding the notice.
//
// A client emailed at 9am Sydney on the day Macquarie's rise took effect was
// quoted the NEW rate with a line underneath saying it did not reflect the
// recent RBA change. Right figure, contradicting sentence, and it corrected
// itself around 11am with nobody the wiser.
describe('the cut-off is Sydney midnight, not London midnight', () => {
  const notice = readNotice({
    on: true, text: 'The rates above do not factor in the recent RBA change.',
    decisionDate: '2026-09-29', reviewBy: '2026-10-20',
  })
  // Announced for that decision, effective 15 October.
  const macquarie = { name: 'Macquarie', rate_notice_for: '2026-09-29', rate_notice_from: '2026-10-15' }
  const at = (iso: string) => noticeFor(macquarie, notice, new Date(iso))

  it('still prints the night before', () => {
    expect(at('2026-10-14T12:59:00Z')).not.toBe('')   // 14 Oct 11:59pm Sydney
  })

  it('stops at midnight Sydney, not at 11am', () => {
    // 15 Oct 00:05 Sydney. Under the old code this was still 14 Oct in UTC and
    // the notice printed - this is the exact minute the bug started each day.
    expect(at('2026-10-14T13:05:00Z')).toBe('')
  })

  it('and is off right through the working day it takes effect', () => {
    expect(at('2026-10-14T22:00:00Z')).toBe('')       // 15 Oct 9am Sydney
    expect(at('2026-10-14T23:30:00Z')).toBe('')       // 15 Oct 10:30am Sydney
    expect(at('2026-10-15T00:30:00Z')).toBe('')       // 15 Oct 11:30am Sydney
  })

  it('and still off the day after', () => {
    expect(at('2026-10-15T22:00:00Z')).toBe('')       // 16 Oct 9am Sydney
  })

  it('and the boundary moves with daylight saving, as it must', () => {
    // THE OFFSET IS NOT A CONSTANT, which is why this is a named time zone
    // rather than "take eleven hours off". NSW is UTC+11 in October and UTC+10
    // in July, so Sydney midnight is a different UTC instant in each - and a
    // fix that subtracted a fixed number of hours would be right for half the
    // year and an hour wrong for the other half.
    const july = { name: 'ANZ', rate_notice_for: '2026-09-29', rate_notice_from: '2026-07-15' }

    // 14 Jul 11:59pm Sydney (UTC+10). Still the 14th - the notice stands.
    expect(noticeFor(july, notice, new Date('2026-07-14T13:59:00Z'))).not.toBe('')
    // 15 Jul 00:00 Sydney. One minute later, and it is off.
    expect(noticeFor(july, notice, new Date('2026-07-14T14:00:00Z'))).toBe('')

    // The October boundary is an hour earlier in UTC, for the same local time.
    expect(at('2026-10-14T12:59:00Z')).not.toBe('')  // 14 Oct 11:59pm Sydney
    expect(at('2026-10-14T13:00:00Z')).toBe('')      // 15 Oct 00:00 Sydney
  })
})
