import { describe, it, expect } from 'vitest'
import { handoverSections } from './handover-view'
import { splitShortName, splitGroupLabel, sharedWithLine } from './who-shares-this-deal'

// THE NUMBERS CAME OFF THE LIST, SO THEY HAD BETTER BE ON THE HANDOVER.
//
// 17 Nov 2026. Fabio: "I don't really need the splits showing, it's very
// busy... those splits are important to go on the handover notes that goes to
// my processing team, but it's pretty irrelevant to my team to see it."
//
// So the dropdown lost its percentages. That is only safe while two things
// stay true, and this file holds both:
//
//   1. The handover still carries every line, in full, for the processing
//      team who actually pay on it.
//   2. The deal page still spells the chosen one out underneath the box, so
//      whoever picked it can check what they picked.
//
// If either stops being true, taking the numbers off the list becomes the
// thing that loses a referrer their money.

const deal = {
  id: 'd1',
  deal_name: 'Test',
  commission_split_id: 's1',
  commission_split_name: 'Simplify Finance Brokers - Justin Cornock',
  commission_split_kind: 'broker_split',
  commission_split_none: false,
  commission_split_at: '2026-11-17T00:00:00Z',
  commission_split_by: 'Fabio de Castro',
  commission_split_lines: [
    { who: 'Justin Cornock', upfront: 80, trail: 80 },
    { who: 'Simplify', upfront: 20, trail: 20 },
  ],
}

function allText(v: any): string {
  return JSON.stringify(v)
}

describe('the handover carries the whole split', () => {
  const view = handoverSections(deal as any)
  const text = allText(view)

  it('there is a commission split section at all', () => {
    expect(text, 'the handover stopped carrying the split').toContain('Commission split')
  })

  it('it names every party', () => {
    expect(text).toContain('Justin Cornock')
    expect(text).toContain('Simplify')
  })

  it('and what each of them gets, upfront and trail', () => {
    // 80 and 20 both have to survive, or somebody is paid the wrong share.
    expect(text).toMatch(/80/)
    expect(text).toMatch(/20/)
  })

  it('and who recorded it', () => {
    expect(text).toContain('Fabio de Castro')
  })

  it('a deal shared with nobody says so rather than going quiet', () => {
    // A deal somebody confirmed is all ours - no arrangement id, the flag set.
    const alone = handoverSections({
      ...deal,
      commission_split_id: null,
      commission_split_name: null,
      commission_split_kind: null,
      commission_split_lines: [],
      commission_split_none: true,
    } as any)
    // The handover's own wording - "Nobody - this one is all ours".
    expect(allText(alone)).toContain('Nobody')
    expect(allText(alone)).toContain('all ours')
  })
})

describe('and the deal page still says the chosen one out loud', () => {
  it('under the box, in words, with every line', () => {
    const line = sharedWithLine(deal as any)
    expect(line).toContain('Justin Cornock')
    expect(line, 'the line stopped saying what they did').toContain('they wrote it')
    expect(line, 'the line stopped carrying the breakdown').toMatch(/80/)
  })
})

describe('the name in the list is the name, not the prefix', () => {
  it('a broker arrangement', () => {
    expect(splitShortName('Simplify Finance Brokers - Justin Cornock')).toBe('Justin Cornock')
  })

  it('a referral', () => {
    expect(splitShortName('Simplify - Keanen Wood referral')).toBe('Keanen Wood')
  })

  it('a firm with no prefix is left alone', () => {
    expect(splitShortName('New Blue Finance')).toBe('New Blue Finance')
  })

  it('and a name that is ONLY the prefix keeps it, rather than going blank', () => {
    expect(splitShortName('Simplify -')).toBe('Simplify -')
    expect(splitShortName('')).toBe('')
  })

  it('the heading says which of the two it is', () => {
    expect(splitGroupLabel('referrer')).toContain('referred')
    expect(splitGroupLabel('broker_split')).toContain('wrote')
  })
})
