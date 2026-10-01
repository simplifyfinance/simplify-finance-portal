import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { TEMPLATE_LABELS } from './templates'
import { missingForEmail } from './bc-ready'

// IS THE SCENARIO ACTUALLY PLUGGED IN EVERYWHERE?
//
// Fabio, 1 Oct 2026: "PLEEEEEEEASE ENSURE the html is linked correctly."
//
// A scenario is not one change, it is six: the picker, the defaults, the boxes
// the email needs, the email itself, the compliance write-up and the lending
// options that follow it. Miss the email and the client gets "Email template
// coming soon." Miss bc-ready and the Preview screen stops naming empty boxes.
// So this does not test debt recycling - it tests EVERY scenario, which is the
// only version of the test the next one cannot slip past.

const route = readFileSync('app/api/generate-email/route.ts', 'utf8')
const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const ids = Object.keys(TEMPLATE_LABELS)

describe('every scenario is wired end to end', () => {
  it('has a scenario in the picker', () => {
    for (const id of ids) {
      expect(form, `${id} is missing from the BC picker`).toContain(`id: '${id}'`)
    }
  })

  it('has default splits, so picking it is not an empty form', () => {
    for (const id of ids) {
      if (id === 'custom') continue  // custom is every field and no opinion
      expect(form, `${id} has no TEMPLATE_DEFAULTS`).toMatch(
        new RegExp(`${id}:\\s*\\{\\s*splits:`))
    }
  })

  // THE ONE THAT MATTERS. Without a branch the client is sent a page that says
  // "Email template coming soon."
  it('builds a client email of its own', () => {
    for (const id of ids) {
      expect(route, `${id} has no branch in generate-email`).toContain(`template === '${id}'`)
    }
  })

  it('and says which boxes that email wanted and did not get', () => {
    // AN UNKNOWN SCENARIO FALLS BACK TO CUSTOM'S TWO BOXES. That is not a
    // missing warning, it is a warning that names almost nothing on a scenario
    // with ten fields - and it passes any test that only counts the boxes.
    const asked = (id: string) => missingForEmail(id, {}).map(m => `${m.label}/${m.where}`).join('|')
    const fallback = asked('custom')
    for (const id of ids) {
      if (id === 'custom') continue
      expect(asked(id), `${id} has no NEEDS list of its own in bc-ready`).not.toBe(fallback)
    }
  })
})

describe('debt recycling in particular', () => {
  it('draws its email from the one file that holds the arithmetic', () => {
    expect(route).toContain("from '@/lib/debt-recycling'")
    const branch = route.slice(route.indexOf("template === 'debt_recycling'"),
                               route.indexOf("template === 'custom'"))
    expect(branch).toContain('openingLine(d)')
    expect(branch).toContain('purposeLine(sp)')
    expect(branch).toContain('ACCOUNTANT_NOTE')
    expect(branch).toContain('whySplitThisWay(d)')
  })

  // THE FIGURE AND ITS DISCLAIMER CANNOT BE SEPARATED.
  //
  // Fabio decided on 1 Oct 2026 that the client email may name a deductible
  // portion, on the condition that the disclaimer goes with it. A figure is one
  // line of code and a disclaimer is another, and the one that gets deleted in
  // six months is never the figure. So this fails the build if the deductible
  // card is ever written without the note, or without the gate that stops it
  // understating.
  it('never prints a deductible figure without the disclaimer', () => {
    const branch = route.slice(route.indexOf("template === 'debt_recycling'"),
                               route.indexOf("template === 'custom'"))
    const card = branch.slice(branch.indexOf("card('Deductible portion'"))
    expect(card).not.toBe('')
    const upToClose = card.slice(0, card.indexOf(': \'\')'))
    expect(upToClose, 'the deductible card has lost its note').toContain('note(ACCOUNTANT_NOTE)')
    expect(branch, 'the deductible figure is no longer gated on every split having a purpose')
      .toContain('everySplitHasAPurpose(d) && purposes.investment > 0')
  })

  it('and the broker is warned, not blocked, when the splits miss the limit', () => {
    expect(form).toContain('limitCheck(buildBcData())')
    // Nothing in the form may refuse to generate over it.
    const guard = form.slice(form.indexOf('limitCheck(buildBcData())'))
    expect(guard.slice(0, 600)).not.toContain('disabled')
  })
})
