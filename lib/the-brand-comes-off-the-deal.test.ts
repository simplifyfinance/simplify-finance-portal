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
// THE SECOND GO, AND WHY THE FIRST WAS WRONG.
//
// The first fix read the brand stored on the deal. lib/which-business.ts says
// why that is not a business: on 12 Nov 2026 every lodged deal in the book read
// "simplify" - all 58 - because the old code fell back to `|| ['simplify']`
// without anybody choosing. So a Navigate deal would still have sent a Simplify
// email, and the only thing that had changed was that somebody had been told it
// was fixed.
describe('every email reads it', () => {
  it('the preview asks which brands the broker is ticked for', () => {
    // 19 Nov 2026: the answer is now held in a variable, because the team's
    // signature reads the brand's name and has to be decided before the email
    // is built. Same question, asked once instead of inline.
    expect(ROUTE).toContain("txt(req.nextUrl.searchParams.get('brandId')) || await brandForDeal(supabase, deal)")
    expect(ROUTE).toContain('const theBrand = await resolveBrand(')
    expect(ROUTE).toContain('return businessOfDeal(deal, data || [])')
  })

  // WHAT WAS READ MUST BE WHAT IS SENT. A preview under one brand and a send
  // under another is the worst version of this bug, not the fixed one.
  it('and the send asks the same question', () => {
    expect(ROUTE).toContain("resolveBrand(txt(form.get('brandId')) || await brandForDeal(supabase, deal))")
  })

  // THE STORED BRAND IS EVIDENCE OF A BUG. It is still read, but only inside
  // businessOfDeal and only to break a tie between brands the broker really
  // holds - never on its own.
  it('and never reads the stored brand on its own', () => {
    expect(ROUTE, 'brandOnDeal alone is the bug this replaced').not.toContain('brandOnDeal(deal)')
  })

  it('the send screen opens on that same answer', () => {
    expect(SCREEN).toContain("preview?.dealBrand || ''")
    expect(ROUTE).toContain('dealBrand: await brandForDeal(supabase, deal)')
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

  // NOBODY PICKS A SENDER ANY MORE - 19 Nov 2026. The final check-in used to,
  // and it carried the brand picker with it. Both are gone: the brand comes
  // off the deal on every template now, which is what this whole file is
  // about, and the signature follows lib/nobody-signs-for-somebody-else.ts.
  it('and no template picks its sender at all', () => {
    for (const t of TEMPLATES) expect(t.picksSender, t.id).toBe(false)
  })

  it('the screen still draws the brand control where a template picks one', () => {
    expect(SCREEN).toContain('<BrandPanel')
  })
})
