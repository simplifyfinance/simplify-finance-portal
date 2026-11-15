// THE BRAND STARTS ON THE BORROWING CAPACITY AND IS CARRIED TO THE LENDING
// OPTIONS. EVERY CLIENT EMAIL HAS TO READ IT.
//
// 17 Nov 2026. Fabio, asked why a settlement email could not go out as
// Navigate: "the brand starts in bc than lo come on weve been doing this for a
// while now and the emplates all of them allow us to chnage brand befroe
// sending."
//
// He was describing how it was meant to work. It did not. brandId only ever
// reached the API from a template that picks its SENDER - one of ten - so every
// other template resolved to the default. A Navigate deal sent a Simplify
// formal approval, a Simplify offer accepted and a Simplify pre-approval, and
// nothing said so: the email is correct in every other respect, and the logo
// at the top is the one thing nobody re-reads.
//
// This test is what stops it coming back.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { brandOnDeal } from './which-business'
import { TEMPLATES, templateById } from './milestone-emails'

const ROUTE = readFileSync('app/api/send-milestone-email/route.ts', 'utf8')
const SCREEN = readFileSync('components/MilestoneEmails.tsx', 'utf8')
const SENDER = readFileSync('app/(app)/templates/useSender.ts', 'utf8')

describe('where the brand is written', () => {
  it('the lending options, then the borrowing capacity', () => {
    expect(brandOnDeal({ lo_data: { brandId: 'navigate' } })).toBe('navigate')
    expect(brandOnDeal({ bc_data: { brand: 'navigate' } })).toBe('navigate')
  })

  it('the lending options win, because they are newer', () => {
    expect(brandOnDeal({ lo_data: { brandId: 'navigate' }, bc_data: { brand: 'simplify' } }))
      .toBe('navigate')
  })

  it('and a deal with neither says nothing rather than guessing', () => {
    expect(brandOnDeal({})).toBe('')
  })
})

// THE FIX, IN ONE LINE EACH.
describe('every email reads it', () => {
  it('the preview falls back to the deal, not to the default brand', () => {
    expect(ROUTE).toContain(
      "resolveBrand(txt(req.nextUrl.searchParams.get('brandId')) || brandOnDeal(deal))")
  })

  // WHAT WAS READ MUST BE WHAT IS SENT. A preview under one brand and a send
  // under another is the worst version of this bug, not the fixed one.
  it('and the send falls back the same way', () => {
    expect(ROUTE).toContain("resolveBrand(txt(form.get('brandId')) || brandOnDeal(deal))")
  })

  it('the send screen opens on the deal brand rather than the broker default', () => {
    expect(SCREEN).toContain("brandOnDeal(deal)")
    expect(SENDER).toContain('preferBrandId')
  })

  // A PERSON'S CHOICE STILL WINS. Fabio: "the templates all of them allow us to
  // change brand before sending."
  it('but a pick on the screen still beats the deal', () => {
    expect(SENDER).toContain('brandPicked')
    expect(SENDER).toContain('const chooseBrand = (v: string) => { setBrandPicked(true); setBrandId(v) }')
  })
})

describe('which templates offer the control', () => {
  // The settlement five are signed by whoever is sending them, so they pick the
  // brand without picking a broker.
  it('the settlement five pick the brand on its own', () => {
    for (const id of ['loan_documents', 'settlement_numbers', 'settlement_booked',
                      'settled', 'month_in']) {
      expect(templateById(id)!.picksBrand, id).toBe(true)
      expect(templateById(id)!.picksSender, id).toBe(false)
    }
  })

  it('and a template that picks its sender has always picked the brand with it', () => {
    for (const t of TEMPLATES) {
      if (t.picksSender) expect(t.picksBrand ?? false, t.id).toBe(false)
    }
    expect(templateById('final_checkin')!.picksSender).toBe(true)
  })

  it('the screen draws the brand control for either', () => {
    expect(SCREEN).toContain("const brandId = (picksSender || picksBrand) ? sender.brandId : ''")
    expect(SCREEN).toContain('<BrandPanel')
  })
})
