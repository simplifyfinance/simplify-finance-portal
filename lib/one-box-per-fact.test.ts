import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { useFromTemplate } from './deal-labels'

// ONE BOX PER FACT.
//
// 29 Oct 2026. Fabio, on an Investment purchase: "State dropdown to choose (all
// templates). Asking State twice." And: "Property type preloads INV."
//
// THREE SYMPTOMS, ONE DISEASE: the same fact had two homes on the screen.
//
//   The suburb box said "State" on every template that buys something, so a
//   purchase deal collected "WA" into its suburb - and the broker notes, the
//   security address and the pre-approval have been printing a state code where
//   a suburb belongs. This is the fault lib/duty-state.ts was written for on
//   30 Sep 2026; it was corrected on the templates that buy nothing and left
//   alone on the ones that matter most.
//
//   The real State dropdown was hidden on four templates, so a refinance had
//   nowhere to record the state at all - the other half of the same write-up.
//
//   And Property type asked a question lib/deal-labels.ts had already answered,
//   giving an investment purchase two boxes that could disagree about whether
//   it was an investment.
//
// This test is the rule rather than the three fixes, because a list of three is
// only as good as the afternoon somebody spent looking.

const BC = readFileSync(
  join(__dirname, '..', 'app', '(app)', 'deals', '[id]', 'BCForm.tsx'), 'utf8')

describe('THE TEMPLATE ANSWERS ITS OWN QUESTION', () => {
  it('an investment template is an investment', () => {
    expect(useFromTemplate('investment_purchase')).toBe('Investment')
    expect(useFromTemplate('investment_equity')).toBe('Investment')
  })

  it('and an owner-occupied one is owner-occupied', () => {
    for (const t of ['oo_purchase', 'oo_lvr_compare', 'fhb', 'family_pledge', 'refinance_equity']) {
      expect(useFromTemplate(t), t).toBe('Owner-occupied')
    }
  })

  it('AND IT SAYS NOTHING WHERE IT GENUINELY DOES NOT KNOW', () => {
    // FROM_TEMPLATE leaves the use off these on purpose: "it follows the
    // property, and a deal can top up an investment to buy a home." Those
    // templates keep the question, because for them it is a real one.
    for (const t of ['top_up', 'top_up_purchase', 'refinance_only', 'buy_sell',
                     'bridging', 'construction']) {
      expect(useFromTemplate(t), t).toBe('')
    }
  })

  it('and SMSF is not forced into the nearest box', () => {
    // The dropdown offers two words and smsf is neither. Left for a person.
    expect(useFromTemplate('smsf')).toBe('')
  })

  it('and nonsense is not an answer', () => {
    for (const t of ['', null, undefined, 'not_a_template']) {
      expect(useFromTemplate(t as any), String(t)).toBe('')
    }
  })

  it('in the dropdown’s own words, so nothing downstream sees a new string', () => {
    expect(['Owner-occupied', 'Investment', ''])
      .toContain(useFromTemplate('investment_purchase'))
  })
})

describe('THE FORM ASKS EACH THING ONCE', () => {
  it('THE SUBURB BOX SAYS SUBURB, ON EVERY TEMPLATE', () => {
    // It writes into `suburb` and always has. The ternary that made it say
    // "State" on buying templates is the whole fault.
    expect(BC).not.toContain("buysNothing(template) ? 'Suburb' : 'State'")
    expect(BC).toContain('<Field label="Suburb"><input className={inputCls} value={suburb}')
  })

  it('and no box bound to the suburb is labelled State', () => {
    for (const m of BC.matchAll(/<Field label=(\{[^}]*\}|"[^"]*")>\s*<input[^>]*value=\{(\w+)\}/g)) {
      const label = m[1]
      const field = m[2]
      if (/suburb/i.test(field)) {
        expect(label, `${field} is behind a label of ${label}`).not.toContain('State')
      }
    }
  })

  it('AND THE STATE DROPDOWN IS ON EVERY TEMPLATE', () => {
    // A property sits in a state whether or not duty is payable on it. It used
    // to share stamp duty's condition, so a refinance could not record one.
    const at = BC.indexOf('<Field label="State">')
    expect(at, 'there is no State dropdown at all').toBeGreaterThan(0)
    const before = BC.slice(Math.max(0, at - 700), at)
    expect(before).not.toContain('"refinance_equity", "refinance_only"')
  })

  it('and stamp duty keeps its own condition, because duty really is conditional', () => {
    const at = BC.indexOf('<Field label="Stamp duty">')
    expect(at).toBeGreaterThan(0)
    expect(BC.slice(Math.max(0, at - 400), at)).toContain('buysNothing(template)')
  })

  it('AND PROPERTY TYPE IS ASKED ONLY WHERE THE TEMPLATE IS SILENT', () => {
    expect(BC).toContain('{!useFromTemplate(template) && (')
    expect(BC).not.toContain('{template !== "fhb" && <Field label="Property type"')
  })

  it('and the value follows the template even with the box hidden', () => {
    // Hiding the dropdown while leaving a guess underneath it would be the
    // Nader fault exactly: a field nobody can see, printing itself onto a
    // client's document.
    expect(BC).toContain('const propertyType = useFromTemplate(template) || propertyTypeTyped')
  })

  it('and nothing is born holding a property type any more', () => {
    expect(BC).not.toContain("useState(s.propertyType || 'Owner-occupied')")
  })
})
