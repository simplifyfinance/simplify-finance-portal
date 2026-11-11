// THE DOCUMENTS BOX SAYS WHAT IT KNOWS.
//
// 11 Nov 2026. Fabio, on Ian Davies' deal: "why I can't click docs to
// request???" Everything on that list had been asked for on the 9th and two
// rows had been unticked by hand, so there was nothing to send - and the
// portal said nothing at all.
import { describe, it, expect } from 'vitest'
import { whyNotRequestable, whyOnTheList, trailFor, askedSummary } from './documents-say-why'
import { withRequest, withChase, lastChase } from './document-progress'

const row = (over: any = {}) => ({
  key: 'k' + Math.random().toString(36).slice(2),
  label: 'Payslips × 2', groupLabel: 'Ian Davies', forWhat: 'lodge',
  ticked: true, ...over,
})
const none = new Set<string>()

describe('the button says why it is off', () => {
  it('when nothing is ticked', () => {
    expect(whyNotRequestable([row({ ticked: false })], none)).toContain('Nothing is ticked')
  })

  // IAN DAVIES, 11 NOV 2026. Six already out, two unticked by hand.
  it('when everything ticked has already gone', () => {
    const rows = [
      row({ ticked: true, requestedAt: '2026-11-09T03:14:00Z' }),
      row({ ticked: true, requestedAt: '2026-11-09T03:14:00Z' }),
      row({ ticked: false, decidedBy: 'Mellissa Sedin' }),
    ]
    const said = whyNotRequestable(rows, none)
    expect(said).toContain('already been asked for')
    expect(said).toContain('chase the 2 still out')
  })

  it('when what is left is covered by the statements', () => {
    const r = row({ ticked: true })
    expect(whyNotRequestable([r], new Set([r.key]))).toContain('covered by the bank statements')
  })

  // AND IT SAYS NOTHING WHEN THE BUTTON WORKS. A sentence under a live button
  // is noise, and noise is what stops people reading the one that matters.
  it('and says nothing at all when there is something to send', () => {
    expect(whyNotRequestable([row({ ticked: true })], none)).toBe('')
  })

  it('survives an empty list', () => {
    expect(whyNotRequestable([], none)).toContain('nothing on the list')
  })
})

describe('why each one is on the list', () => {
  // A handful of rules write their own reason because the name does not
  // explain itself. Those win.
  it('uses the rule’s own words where it has any', () => {
    expect(whyOnTheList(row({ why: 'Living with family' }))).toBe('Living with family')
  })

  // The rest get the two facts every row carries. Thinner than a written
  // sentence, and true - which a generated one would not reliably be.
  it('falls back to whose it is and what it is for', () => {
    expect(whyOnTheList(row())).toBe('Ian Davies — needed before this can be lodged')
    expect(whyOnTheList(row({ forWhat: 'compliance' })))
      .toBe('Ian Davies — needed for the compliance file')
  })

  it('says nothing rather than half a sentence', () => {
    expect(whyOnTheList({})).toBe('')
  })
})

describe('what happened to it', () => {
  const NOW = new Date('2026-11-11T00:00:00')

  // Midnight to midnight, so the number is the same wherever this runs.
  it('says when it was asked for and how long it has been', () => {
    expect(trailFor(row({ requestedAt: '2026-11-09T00:00:00' }), NOW))
      .toBe('Asked 9 Nov · waiting 2 days')
    expect(trailFor(row({ requestedAt: '2026-11-11T00:00:00' }), NOW))
      .toBe('Asked 11 Nov · asked today')
  })

  it('says when it came back, and who said so', () => {
    expect(trailFor(row({ receivedAt: '2026-11-10T00:00:00', receivedBy: 'Mellissa Sedin' }), NOW))
      .toBe('Arrived 10 Nov, marked by Mellissa Sedin.')
  })

  // UNTICKED IS A DECISION. Without the name it reads as an oversight and the
  // next person ticks it straight back.
  it('keeps the name of whoever took it off', () => {
    expect(trailFor(row({ ticked: false, decidedBy: 'Mellissa Sedin' }), NOW))
      .toBe('Taken off the list by Mellissa Sedin — never asked for.')
  })
})

describe('the rounds, folded into one line', () => {
  const NOW = new Date('2026-11-11T00:00:00')

  it('says so when nobody has asked for anything', () => {
    expect(askedSummary([], null, 0, 0, NOW)).toContain('Nobody has asked')
  })

  // The number that decides what you do this morning.
  it('says never chased, because that is usually the answer', () => {
    const said = askedSummary([{ at: '2026-11-09T03:14:00', by: 'Mellissa Sedin' }], null, 1, 6, NOW)
    expect(said).toContain('Mellissa Sedin')
    expect(said).toContain('6 documents, 1 back')
    expect(said).toContain('Never chased.')
  })

  it('and how long ago it was when somebody has', () => {
    expect(askedSummary([{ at: '2026-11-09T03:14:00', by: 'Mel' }], '2026-11-10T00:00:00', 1, 6, NOW))
      .toContain('Last chased yesterday.')
  })
})

describe('a chase is not a second request', () => {
  // Pressing request again would send the same list to the same person as
  // though nobody had replied, and would mark nothing newly asked for.
  it('is recorded on its own, and never as a request', () => {
    const after = withChase({}, ['a', 'b'], 'Mel', '2026-11-11T00:00:00', 'Kylie')
    expect(after.chases).toHaveLength(1)
    expect(after.requests || []).toHaveLength(0)
    expect(lastChase(after)!.to).toBe('Kylie')
  })

  it('and a request keeps who it went to', () => {
    const after = withRequest({}, ['a'], 'Mel', '2026-11-09T03:14:00', 'Kylie Nguyen')
    expect(after.requests![0].to).toBe('Kylie Nguyen')
  })

  // Rounds written before 11 Nov 2026 have no answer, and inventing one would
  // be worse than leaving it off.
  it('leaves it off where nobody recorded it', () => {
    expect(withRequest({}, ['a'], 'Mel', '2026-11-09T03:14:00').requests![0].to).toBe(undefined)
  })

  it('and never has been chased is a real answer', () => {
    expect(lastChase({})).toBe(null)
  })
})
