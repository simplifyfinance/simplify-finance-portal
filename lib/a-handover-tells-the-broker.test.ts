// The broker is told when their deal goes for compliance prep. 17 Aug 2026.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  STAGE_LABELS, dealLine, handoverSubject, handoverHtml, handoverText, shapeOf,
} from './a-handover-tells-the-broker'

const F = {
  dealName: 'Mai Chen & Jessie Cardey 2026',
  brokerFirstName: 'Fabio',
  officerName: 'Ellie Nguyen',
  lender: 'ANZ',
  shape: 'refinance, owner occupied',
  amount: '$960,000',
  dealUrl: 'https://portal.example.com/deals/abc',
}

describe('the email', () => {
  it('names the deal in the subject', () => {
    expect(handoverSubject(F)).toBe('Compliance prep started: Mai Chen & Jessie Cardey 2026')
  })

  // "Ellie has finished" reads as a handover. "The credit team has finished"
  // reads as a system message.
  it('names who finished it', () => {
    expect(handoverHtml(F)).toContain('Ellie Nguyen has finished the lending options')
    expect(handoverText(F)).toContain('Ellie Nguyen has finished')
  })

  it('still reads properly with no officer on it', () => {
    const none = handoverHtml({ ...F, officerName: '' })
    expect(none).not.toContain('has finished')
    expect(none).toContain('has moved to compliance prep')
  })

  // Alan: they want to add information or double-check details BEFORE
  // compliance is finalised. So the email says when that stops being possible.
  it('says why it was sent and when the window closes', () => {
    expect(handoverHtml(F)).toContain('now is the moment')
    expect(handoverHtml(F)).toContain('once compliance is issued it is a record')
  })

  it('carries enough to know which file it is', () => {
    expect(dealLine(F)).toBe('ANZ · refinance, owner occupied · $960,000 · Ellie Nguyen')
    expect(handoverHtml(F)).toContain('ANZ · refinance')
  })

  it('leaves out what it does not have rather than printing a gap', () => {
    expect(dealLine({ ...F, lender: '', amount: '' }))
      .toBe('refinance, owner occupied · Ellie Nguyen')
    expect(dealLine({ ...F, lender: '', shape: '', amount: '', officerName: '' })).toBe('')
  })

  // A client called "Smith & Jones <Trust>" must not break the email.
  it('escapes what goes into the HTML', () => {
    const risky = handoverHtml({ ...F, dealName: 'Smith & Jones <Trust>' })
    expect(risky).toContain('Smith &amp; Jones &lt;Trust&gt;')
    expect(risky).not.toContain('<Trust>')
  })

  it('has a plain text version that says the same thing', () => {
    const t = handoverText(F)
    expect(t).toContain('now is the moment')
    expect(t).toContain(F.dealUrl)
    expect(t).not.toContain('<')
  })
})

describe('the deal in words', () => {
  it('reads the two fields that replaced deal_type', () => {
    expect(shapeOf({ transaction_type: 'refinance', property_use: 'owner_occupied' }))
      .toBe('refinance, owner occupied')
  })

  it('says nothing rather than an empty phrase', () => {
    expect(shapeOf({})).toBe('')
    expect(shapeOf(null)).toBe('')
    expect(shapeOf({ transaction_type: 'purchase' })).toBe('purchase')
  })
})

describe('the stage it fires at', () => {
  it('knows compliance prep, beside the two it already had', () => {
    expect(STAGE_LABELS.COMPLIANCE).toBe('Compliance prep')
    expect(STAGE_LABELS.BC).toBe('Borrowing Capacity')
    expect(STAGE_LABELS.LO).toBe('Lending Options')
  })

  // One place fires it, for both the "I'll take it" and the "put it in the
  // queue" paths - otherwise one of the two quietly stops telling anybody.
  it('is fired from the one function both handover paths go through', () => {
    const src = readFileSync('lib/hand-this-stage-over.ts', 'utf8')
    expect(src).toContain('notify-broker-stage-complete')
    expect(src).toContain('COMPLIANCE')
  })

  it('and info@ is on it', () => {
    const route = readFileSync('app/api/notify-broker-stage-complete/route.ts', 'utf8')
    expect(route).toContain('info@simplifyfinance.com.au')
  })
})
