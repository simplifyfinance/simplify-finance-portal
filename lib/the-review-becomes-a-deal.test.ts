// A GOOD REVIEW BECOMES A DEAL.
//
// 26 Oct 2026. Fabio, on the half of the process that was never finished: "we
// were going to log calls and if successful I would create a deal card in one
// upload current fact find and register as a new lead we are not there yet
// with any leads but need to know the process works".
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  secondName, dealNameFromReview, seededProperty, ownershipSplit,
  factFindFromReview, dealRowFromReview, makeApplicant, REVIEW_LEAD_SOURCE,
} from './the-review-becomes-a-deal'

describe('the second person on the book row', () => {
  it('finds them', () => {
    expect(secondName('Justin Barrasch, Jodie Verrall', 'Justin', 'Barrasch'))
      .toEqual({ first: 'Jodie', last: 'Verrall' })
  })

  it('does not hand back the same person twice', () => {
    expect(secondName('Justin Barrasch', 'Justin', 'Barrasch')).toBeNull()
  })

  it('and refuses to guess where it cannot tell', () => {
    // One word is a company or half a name. A wrong applicant on a new deal is
    // worse than a missing one - somebody has to notice it to fix it.
    expect(secondName('Barrasch Holdings Pty Ltd, Trustee', 'Justin', 'Barrasch'))
      .toEqual({ first: 'Barrasch', last: 'Holdings Pty Ltd' })
    expect(secondName('Justin Barrasch, Jodie', 'Justin', 'Barrasch')).toBeNull()
    expect(secondName('', 'Justin', 'Barrasch')).toBeNull()
  })
})

describe('what the deal is called', () => {
  it('First Last & First Last Year, the same as a deal built by hand', () => {
    expect(dealNameFromReview('Justin', 'Barrasch', { first: 'Jodie', last: 'Verrall' }, 2026))
      .toBe('Justin Barrasch & Jodie Verrall 2026')
  })

  it('and one name where there is one', () => {
    expect(dealNameFromReview('Justin', 'Barrasch', null, 2026)).toBe('Justin Barrasch 2026')
  })
})

describe('the fact find it starts with', () => {
  const props = [
    { ordinal: 2, address: '26 Oliver St, Lyneham ACT', investor: true,
      lender_raw: 'NAB Broker', current_balance: 252176.72, estimated_current_value: 419853 },
    { ordinal: 1, address: '25 Getting Cres, Campbell ACT', investor: true,
      lender_raw: 'NAB', original_loan: 366000, original_value: 1600000 },
    { ordinal: 3, address: '', investor: true },
  ]
  const applicants = [{ id: 'a1' }, { id: 'a2' }]
  const ff = factFindFromReview(applicants, props as any, () => 'fixed')

  it('carries every security, in the book\\u2019s order', () => {
    expect(ff.properties.map(p => p.address))
      .toEqual(['25 Getting Cres, Campbell ACT', '26 Oliver St, Lyneham ACT'])
  })

  it('leaves out a row with no address rather than seeding a blank one', () => {
    expect(ff.properties).toHaveLength(2)
  })

  it('brings the lender and the balance as a loan on the property', () => {
    const [, oliver] = ff.properties
    expect(oliver.loans).toHaveLength(1)
    expect(oliver.loans[0].lenderName).toBe('NAB Broker')
    expect(oliver.loans[0].balance).toBe('252177')
    expect(oliver.value).toBe('419853')
  })

  it('falls back to what the book recorded at settlement', () => {
    const [campbell] = ff.properties
    expect(campbell.loans[0].balance).toBe('366000')
    expect(campbell.value).toBe('1600000')
  })

  it('splits ownership between whoever is on the deal', () => {
    expect(ownershipSplit(['a1', 'a2'])).toEqual({ a1: '50', a2: '50' })
    expect(ownershipSplit(['a1'])).toEqual({ a1: '100' })
    expect(ff.properties[0].ownership).toEqual({ a1: '50', a2: '50' })
  })

  it('and a property with no loan recorded gets no loan invented', () => {
    const bare = seededProperty({ address: '1 Nowhere St' } as any, {}, () => 'fixed')
    expect(bare.loans).toEqual([])
    expect(bare.value).toBe('')
  })
})

// THE ONE THAT STOPS THIS ROTTING.
//
// The fact find form owns the shape of a property. If it grows a field and
// this file does not set it, a seeded property arrives half-formed and loses
// boxes the first time somebody saves over it. So the form itself is read.
describe('the shape matches the fact find', () => {
  const form = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')
  const keysOf = (fn: string) => {
    const at = form.indexOf(`const ${fn} = ()`)
    const body = form.slice(at, form.indexOf('\n})', at))
    // ONE BACKSLASH. The first version of this had two, so the character
    // class read as "a backslash, an s, a brace or a comma" and every word
    // ending in s or b was collected as a field name.
    return [...body.matchAll(/(?:^|[\s{,])([a-zA-Z][a-zA-Z0-9]*):/g)].map(m => m[1])
  }
  const seeded = seededProperty(
    { address: '1 Test St', lender_raw: 'NAB', current_balance: 1, estimated_current_value: 2 } as any,
    {}, () => 'fixed')

  it('a seeded property sets every field the form defaults', () => {
    for (const k of keysOf('defaultProperty')) {
      expect(seeded, `defaultProperty() has ${k} and a seeded property does not`).toHaveProperty(k)
    }
  })

  it('and so does the loan on it', () => {
    for (const k of keysOf('defaultPropertyLoan')) {
      expect(seeded.loans[0], `defaultPropertyLoan() has ${k} and a seeded loan does not`).toHaveProperty(k)
    }
  })
})

describe('the deal row itself', () => {
  const row = dealRowFromReview({
    dealName: 'Justin Barrasch 2026', clientId: 'c1', brokerKey: 'fabio',
    factFind: { applicants: [], properties: [], liabilities: [], assets: [] },
  })

  it('is registered as a lead from the review', () => {
    // Left blank it would be indistinguishable from a referral, and the whole
    // point of the book is knowing what it produced.
    expect(row.lead_source).toBe(REVIEW_LEAD_SOURCE)
    expect(REVIEW_LEAD_SOURCE).toBe('Portfolio review')
  })

  it('starts on the fact find, like any other new deal', () => {
    expect(row.stage).toBe('FactFind')
    expect(row.status).toBe('in_progress')
  })

  it('and carries the broker off the book', () => {
    expect(row.assigned_broker).toBe('fabio')
  })
})

describe('the screen that does it', () => {
  const box = readFileSync('components/ReviewActions.tsx', 'utf8')

  it('offers it, and then says what it is about to build', () => {
    expect(box).toContain('Became a deal')
    expect(box).toContain('Create the deal card')
  })

  it('writes the link back, which nothing ever did before', () => {
    expect(box).toContain('linked_deal_id: (deal as any).id')
    expect(box).toContain("outcome: 'converted'")
  })

  it('and keeps the deal even if the link fails', () => {
    // Throwing away a created deal because the review would not be marked is
    // the worse trade. It says so instead.
    expect(box).toContain('The deal was created, but the review was not marked')
  })

  it('an applicant still carries its client record', () => {
    // Everything that writes a client's position is gated on this one field.
    expect(box).toContain('makeApplicant(first, last, email, phone, clientId || undefined)')
  })
})

describe('an applicant is built one way everywhere', () => {
  it('the new deal modal reads the shared one', () => {
    const page = readFileSync('app/(app)/deals/page.tsx', 'utf8')
    expect(page).toContain("import { makeUid, makeApplicant } from '@/lib/the-review-becomes-a-deal'")
    expect(page, 'there is a second copy of makeApplicant again')
      .not.toContain('function makeApplicant(')
  })

  it('and it carries the client id it is given', () => {
    const a = makeApplicant('Justin', 'Barrasch', 'j@example.com', '0400000000', 'c1')
    expect(a.clientId).toBe('c1')
    expect(a.firstName).toBe('Justin')
    expect(a.emailPersonal).toBe('j@example.com')
  })
})
