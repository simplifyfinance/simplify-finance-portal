import { describe, it, expect } from 'vitest'
import {
  emailFreshness, needsAttention, notesAreUntouched, notesAfterScenarioChange,
} from './email-freshness'

const INVESTMENT_NOTES = ['We have assumed a minimum rental yield of 4% p.a. Please note, rental yield is a key component in determining your borrowing capacity for an investment purchase.']
const FHB_NOTES: string[] = []
const BUY_SELL_NOTES = [
  'This is your estimated borrowing capacity as of today and it can change by the time you are ready to apply.',
  'The figures used for the proposed sale are only estimated amounts.',
]

describe('is the saved email still the right email', () => {
  it('is fresh when nothing has been generated', () => {
    expect(emailFreshness({}, 'fhb').state).toBe('fresh')
    expect(emailFreshness({ emailHtml: '' }, 'fhb').state).toBe('fresh')
    expect(emailFreshness({ emailHtml: '   ' }, 'fhb').state).toBe('fresh')
    expect(emailFreshness(null, 'fhb').state).toBe('fresh')
  })

  it('is fresh when the saved email was written for the scenario the deal is on', () => {
    const f = emailFreshness({ emailHtml: '<p>hi</p>', emailHtmlTemplate: 'fhb' }, 'fhb')
    expect(f.state).toBe('fresh')
    expect(needsAttention(f)).toBe(false)
  })

  // THE REPORTED BUG.
  it('catches an investment email left on a deal that is now first home buyer', () => {
    const f = emailFreshness({ emailHtml: '<p>rental yield…</p>', emailHtmlTemplate: 'investment_purchase' }, 'fhb')
    expect(f).toEqual({ state: 'stale', wasFor: 'investment_purchase', nowOn: 'fhb' })
    expect(needsAttention(f)).toBe(true)
  })

  it('says so rather than guessing when the saved email predates the stamp', () => {
    const f = emailFreshness({ emailHtml: '<p>hi</p>' }, 'fhb')
    expect(f).toEqual({ state: 'unknown', nowOn: 'fhb' })
    // Nothing to say - every deal generated before today looks like this, and
    // a warning on all of them is noise about a thing we are not sure of.
    expect(needsAttention(f)).toBe(false)
  })

  it('treats a null stamp the same as a missing one', () => {
    expect(emailFreshness({ emailHtml: '<p>hi</p>', emailHtmlTemplate: null }, 'fhb').state).toBe('unknown')
  })
})

describe('and the figures it was written from', () => {
  const SAVED = { emailHtml: '<p>hi</p>', emailHtmlTemplate: 'fhb' }
  const WAS = { "Alexis Janes's income": '$146,380', 'the credit card with ANZ limit': '$15,000' }

  it('is fresh when the figures have not moved', () => {
    const f = emailFreshness({ ...SAVED, emailFigures: WAS }, 'fhb', { ...WAS })
    expect(f.state).toBe('fresh')
    expect(needsAttention(f)).toBe(false)
  })

  // THE THING THAT KEPT HAPPENING: the email looks finished, the figure moved
  // underneath it, and nothing said so.
  it('names the figure that moved', () => {
    const f = emailFreshness({ ...SAVED, emailFigures: WAS }, 'fhb',
      { ...WAS, 'the credit card with ANZ limit': '$10,000' })
    expect(f).toEqual({ state: 'figures-moved',
      changes: ['the credit card with ANZ limit changed from $15,000 to $10,000'] })
  })

  it('asks to be looked at, and does not stop the send', () => {
    // Fabio, 8 Sep 2026: "never block things." The warning is the whole
    // mechanism; the judgement stays with the broker.
    const f = emailFreshness({ ...SAVED, emailFigures: WAS }, 'fhb',
      { ...WAS, "Alexis Janes's income": '$0' })
    expect(needsAttention(f)).toBe(true)
  })

  it('lists every figure that moved, not just the first', () => {
    const f = emailFreshness({ ...SAVED, emailFigures: WAS }, 'fhb',
      { "Alexis Janes's income": '$160,000', 'the credit card with ANZ limit': '$10,000' })
    expect(f.state).toBe('figures-moved')
    expect((f as any).changes).toHaveLength(2)
  })

  // The scenario rewrites the whole email, so there is no point naming a figure
  // inside a card that is not going to be there.
  it('reports the changed scenario first when both have changed', () => {
    const f = emailFreshness({ emailHtml: '<p>x</p>', emailHtmlTemplate: 'investment_purchase', emailFigures: WAS },
      'fhb', { ...WAS, "Alexis Janes's income": '$160,000' })
    expect(f.state).toBe('stale')
  })

  it('says nothing about figures on an email written before they were recorded', () => {
    // Fabio, 3 Sep 2026: "as long as it's fixed moving forward." An email with
    // no record of what it was written from cannot be compared, and guessing
    // would put a warning on every old deal in the portal.
    const f = emailFreshness(SAVED, 'fhb', { ...WAS, "Alexis Janes's income": '$1' })
    expect(f.state).toBe('fresh')
    expect(needsAttention(f)).toBe(false)
  })

  it('says nothing when the preview has not worked out the figures yet', () => {
    const f = emailFreshness({ ...SAVED, emailFigures: WAS }, 'fhb')
    expect(f.state).toBe('fresh')
  })
})

describe('the notes that come with a scenario', () => {
  it('knows untouched default notes', () => {
    expect(notesAreUntouched(INVESTMENT_NOTES.join('\n'), INVESTMENT_NOTES)).toBe(true)
    expect(notesAreUntouched(BUY_SELL_NOTES.join('\n'), BUY_SELL_NOTES)).toBe(true)
  })

  it('ignores stray blank lines and trailing spaces', () => {
    expect(notesAreUntouched('\n' + INVESTMENT_NOTES[0] + '  \n\n', INVESTMENT_NOTES)).toBe(true)
  })

  it('knows an empty box on a scenario that has no notes', () => {
    expect(notesAreUntouched('', FHB_NOTES)).toBe(true)
    expect(notesAreUntouched(null, FHB_NOTES)).toBe(true)
  })

  it('knows the broker has written something', () => {
    expect(notesAreUntouched(INVESTMENT_NOTES[0] + '\nValuation ordered 1 Sep.', INVESTMENT_NOTES)).toBe(false)
    expect(notesAreUntouched('Client wants offset.', INVESTMENT_NOTES)).toBe(false)
  })

  it('counts deliberately clearing the notes as writing', () => {
    // They emptied the box on purpose. Refilling it would undo that.
    expect(notesAreUntouched('', INVESTMENT_NOTES)).toBe(false)
  })

  // THE SECOND HALF OF THE REPORTED BUG: a regenerated first-home-buyer email
  // still telling a first home buyer about rental yield.
  it('swaps untouched investment notes out when the scenario becomes first home buyer', () => {
    expect(notesAfterScenarioChange(INVESTMENT_NOTES.join('\n'), INVESTMENT_NOTES, FHB_NOTES)).toBe('')
  })

  it('swaps untouched notes in the other direction too', () => {
    expect(notesAfterScenarioChange('', FHB_NOTES, BUY_SELL_NOTES)).toBe(BUY_SELL_NOTES.join('\n'))
  })

  it('never deletes anything the broker typed', () => {
    const written = INVESTMENT_NOTES[0] + '\nValuation ordered 1 Sep.'
    expect(notesAfterScenarioChange(written, INVESTMENT_NOTES, FHB_NOTES)).toBe(written)
    expect(notesAfterScenarioChange('Client wants offset.', INVESTMENT_NOTES, BUY_SELL_NOTES)).toBe('Client wants offset.')
  })
})
