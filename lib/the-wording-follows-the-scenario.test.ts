import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  emailAfterScenarioChange, notesAfterScenarioChange, notesAreUntouched,
} from './email-freshness'

// THE WORDING FOLLOWS THE SCENARIO.
//
// 2 Nov 2026. Fabio: "I did a BC deal card, did the template refinance + equity
// plus purchase, I then changed the template to refinance and equity only -
// however the wording template on html is showing original detail. We need the
// portal always reset wording based on current bc template."
//
// Two separate ways the old scenario's words survived a change.
//
// THE SAVED EMAIL. The email is built once and saved onto the deal; the
// preview, Copy to Outlook and Send all read that saved copy back. Changing
// the scenario only put a warning above it - and left three cards describing a
// purchase that was no longer part of the deal, one button away from a client.
//
// THE NOTES. "Important things to note" is filled in from the scenario. It was
// all or nothing on the whole box: untouched and it was swapped, one character
// of the broker's own and EVERY line stayed, including the ones the old
// scenario had written. A broker who added a sentence to an investment note
// kept the rental yield line for ever, on a first home buyer.

describe('THE SAVED EMAIL COMES DOWN WITH THE SCENARIO', () => {
  it('cleared, and the stamps with it', () => {
    const out = emailAfterScenarioChange(
      { emailHtml: '<p>a purchase</p>', emailHtmlTemplate: 'refi_equity_purchase',
        emailFigures: { a: 1 } as any, emailQuestions: ['x'] },
      'Refinance + equity + purchase')
    expect(out).not.toBe(null)
    expect(out!.emailHtml).toBe('')
    // The stamps describe wording that is gone. Left behind, they would warn
    // about an email that no longer exists.
    expect(out!.emailHtmlTemplate).toBe('')
    expect(out!.emailFigures).toBe(null)
    expect(out!.emailQuestions).toBe(null)
  })

  it('AND IT SAYS WHAT IT WAS WRITTEN FOR', () => {
    // Emptying a preview without a word is its own way of losing work.
    const out = emailAfterScenarioChange({ emailHtml: '<p>x</p>' }, 'Refinance + equity + purchase')
    expect(out!.resetFrom).toBe('Refinance + equity + purchase')
  })

  it('and a broker who has not generated yet is told nothing', () => {
    // There is no wording to clear, so saying it was reset would be a lie.
    expect(emailAfterScenarioChange({ emailHtml: '' }, 'Anything')).toBe(null)
    expect(emailAfterScenarioChange({ emailHtml: '   ' }, 'Anything')).toBe(null)
    expect(emailAfterScenarioChange(null, 'Anything')).toBe(null)
    expect(emailAfterScenarioChange(undefined, 'Anything')).toBe(null)
  })
})

describe('AND THE NOTES ARE SWAPPED A LINE AT A TIME', () => {
  const OLD = ['Assumes a 4% rental yield.', 'Investment lending is assessed at a higher rate.']
  const NEW = ['First home buyer grants have been assumed where eligible.']

  it('an untouched box becomes the new scenario, as it always did', () => {
    expect(notesAfterScenarioChange(OLD.join('\n'), OLD, NEW)).toBe(NEW.join('\n'))
  })

  it('AND A LINE THE BROKER WROTE SURVIVES THE CHANGE', () => {
    const typed = [...OLD, 'Client wants settlement before 14 December.'].join('\n')
    const out = notesAfterScenarioChange(typed, OLD, NEW)
    expect(out).toContain('Client wants settlement before 14 December.')
  })

  it('AND THE OLD SCENARIO’S LINES DO NOT', () => {
    // This is the hole. Before today, one typed sentence kept the rental yield
    // line on a first home buyer for ever.
    const typed = [...OLD, 'Client wants settlement before 14 December.'].join('\n')
    const out = notesAfterScenarioChange(typed, OLD, NEW)
    expect(out).not.toContain('rental yield')
    expect(out).not.toContain('Investment lending')
  })

  it('and the new scenario goes first, with the broker underneath', () => {
    const typed = [...OLD, 'Settlement before 14 December.'].join('\n')
    expect(notesAfterScenarioChange(typed, OLD, NEW))
      .toBe('First home buyer grants have been assumed where eligible.\nSettlement before 14 December.')
  })

  it('AND A LINE BOTH SCENARIOS WRITE IS NOT WRITTEN TWICE', () => {
    // Two investment templates say the same thing about rental yield, and a
    // broker who kept that line would otherwise see it doubled.
    const shared = ['Assumes a 4% rental yield.']
    const typed = ['Assumes a 4% rental yield.', 'Mine.'].join('\n')
    expect(notesAfterScenarioChange(typed, shared, shared))
      .toBe('Assumes a 4% rental yield.\nMine.')
  })

  it('and indenting a default does not turn it into somebody’s writing', () => {
    const typed = OLD.map(l => '   ' + l).join('\n\n')
    expect(notesAfterScenarioChange(typed, OLD, NEW)).toBe(NEW.join('\n'))
  })

  it('and an empty box just takes the new lines', () => {
    expect(notesAfterScenarioChange('', OLD, NEW)).toBe(NEW.join('\n'))
    expect(notesAfterScenarioChange(null, OLD, NEW)).toBe(NEW.join('\n'))
  })

  it('AND NOTHING THE BROKER WROTE IS EVER LOST', () => {
    const mine = ['One.', 'Two.', 'Three.']
    const out = notesAfterScenarioChange([...OLD, ...mine].join('\n'), OLD, NEW)
    for (const line of mine) expect(out).toContain(line)
    // In their order, which is part of what they wrote.
    expect(out.indexOf('One.')).toBeGreaterThan(-1)
    expect(out.indexOf('Two.')).toBeGreaterThan(out.indexOf('One.'))
    expect(out.indexOf('Three.')).toBeGreaterThan(out.indexOf('Two.'))
  })

  it('and the older question is still answerable on its own', () => {
    expect(notesAreUntouched(OLD.join('\n'), OLD)).toBe(true)
    expect(notesAreUntouched([...OLD, 'Mine.'].join('\n'), OLD)).toBe(false)
  })
})

describe('AND THE FORM DOES BOTH, IN BOTH PLACES A SCENARIO CHANGES', () => {
  const BC = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  it('the template chips', () => {
    expect(BC).toContain('resetEmailFor(templateLabel(previous))')
  })

  it('AND ANSWERING WHAT HAPPENS TO THE SALE PROCEEDS', () => {
    // It changes which splits the email describes - one end debt, or a land
    // loan and a construction facility - so the wording is as wrong as it
    // would be after a template chip.
    expect(BC).toContain('resetEmailFor(templateLabel(template))')
  })

  it('and generating puts the screen back', () => {
    expect(BC).toContain("setEmailResetFrom('')")
  })

  it('AND THE FIELD HAS A SETTER, SO A MERGE CANNOT DROP IT', () => {
    expect(BC).toContain('emailResetFrom: setEmailResetFrom')
  })
})
