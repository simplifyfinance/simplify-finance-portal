import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  TEMPLATES, menuFor, menuToBrowse, templateById, suggestedFor, SENT_FROM_ITS_OWN_STEP,
} from './milestone-emails'

// ONE WAY IN, AND IT IS THE SCREEN THAT ASKS FOR THE FIGURES.
//
// 21 Oct 2026. Fabio sent the offer accepted email from the Templates page
// against a deal that had never had an offer accepted. The email quoted Orange
// Advantage at 5.99% over 30 years - nobody had typed any of it. Those came off
// the lending option, which is what the clients were PRE-APPROVED on, and that
// is the exact fault Belle reported and this template was built to end.
//
// The five figures it quotes are only asked for in The loan now, on the offer
// accepted step. Reached from anywhere else there is no way to answer them, so
// the email falls back to the pre-approval and says nothing about having done
// so. Fabio: "think best to have one way to send that and it is via offer
// accepted process this is going to be too hard otherwise", and of the deal
// card menu, "no point being there either".
//
// So this test is the door. Put it back in either list and the build stops.

const deals: [string, any][] = [
  ['a brand new deal', {}],
  ['a pre-approved deal', { preapproval_at: '2026-09-01' }],
  ['a deal with an offer accepted', { preapproval_at: '2026-09-01', offer_accepted_at: '2026-10-16' }],
  ['a formally approved deal', { preapproval_at: '2026-09-01', formal_approval_at: '2026-10-20' }],
  ['a settled deal', { settled_at: '2026-11-27' }],
]

describe('the offer accepted email has one door', () => {
  it('is named as sent from its own step', () => {
    expect(SENT_FROM_ITS_OWN_STEP).toContain('offer_accepted')
  })

  it('never appears in a list somebody browses, on any deal', () => {
    for (const [what, deal] of deals) {
      expect(menuToBrowse(deal).map(i => i.id), `${what} is still offered it in the menu`)
        .not.toContain('offer_accepted')
    }
  })

  it('and the deal card really does draw the browsable list', () => {
    const src = readFileSync('components/MilestoneEmails.tsx', 'utf8')
    expect(src).toContain('const menu = menuToBrowse(deal)')
  })

  it('and the Templates page leaves it out of From a deal', () => {
    const src = readFileSync('app/(app)/templates/TemplatesClient.tsx', 'utf8')
    expect(src).toContain('!SENT_FROM_ITS_OWN_STEP.includes(t.id)')
    // Left out, not disappeared: the page still says where to send it from.
    expect(src).toContain('ELSEWHERE')
  })
})

describe('and the door itself still opens', () => {
  it('the step’s link resolves the template', () => {
    // components/OfferAccepted.tsx ends with a link to ?email=offer_accepted,
    // and MilestoneEmails opens it through templateById - not through the menu.
    expect(templateById('offer_accepted')).toBeTruthy()
    const step = readFileSync('components/OfferAccepted.tsx', 'utf8')
    expect(step).toContain('?email=offer_accepted')
    const src = readFileSync('components/MilestoneEmails.tsx', 'utf8')
    expect(src).toContain('templateById(want as TemplateId)')
  })

  it('the record of what exists is still complete', () => {
    // menuFor is the record. Only the two lists filter it, so nothing that
    // reads the full menu - readiness, what has been sent, the history - loses
    // sight of this template.
    expect(TEMPLATES.map(t => t.id)).toContain('offer_accepted')
    expect(menuFor({ offer_accepted_at: '2026-10-16' }).map(i => i.id)).toContain('offer_accepted')
  })

  it('and it is still never the suggestion', () => {
    for (const [, deal] of deals) {
      expect(suggestedFor(deal)).not.toBe('offer_accepted')
    }
  })
})
