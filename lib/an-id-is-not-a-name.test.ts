import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { showingOwner } from './who-did-this-stage'

// AN ID IS NOT A NAME.
//
// 16 Nov 2026. The head of the "Where it is" box went live reading
// "With 13544bdc-ef74-41d2-bae4-89884b9334ea". Fabio found it on a real deal
// within the hour of it shipping.
//
// deals.assigned_credit_officer is a uuid. It was printed straight onto the
// screen because on the test deal it happened to be empty, so nothing showed
// and nothing looked wrong. Every real deal has one.
//
// THE FIX IS NOT A TIDY-UP OF THAT ONE LINE. The portal already has exactly
// one answer to "whose stage is this", and it returns a NAME -
// showingOwner() in lib/who-did-this-stage.ts. The row inside the form has
// read it since 23 Oct. The head of the box reads the same one now, so the
// two halves of one screen cannot disagree, and neither can print an id.

const PAGE = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
const UUID = '13544bdc-ef74-41d2-bae4-89884b9334ea'

describe('the deal page never prints an id at a person', () => {
  it('reads the one function that answers with a name', () => {
    expect(PAGE).toContain("import { showingOwner } from '@/lib/who-did-this-stage'")
    expect(PAGE).toContain("showingOwner(dealData, 'bc')")
  })

  it('and never puts the raw column on screen', () => {
    expect(PAGE, 'assigned_credit_officer is a uuid - it is not for reading')
      .not.toContain('With {dealData.assigned_credit_officer}')
    expect(PAGE).not.toContain('{String(dealData.assigned_credit_officer).split')
  })

  it('refuses to draw anything when all it has is an id', () => {
    // The guard in the page, asserted on the shape of a uuid rather than on
    // the page's text, so it keeps working when the wording changes.
    expect(PAGE).toMatch(/\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-/)
  })
})

describe('the function it now reads really does answer with a name', () => {
  it('a credit officer who has the BC', () => {
    const who = showingOwner(
      { bc_officer_name: 'Mellissa Sedin', bc_officer_id: 'x', assigned_broker: 'Fabio de Castro' },
      'bc')
    expect(who?.name).not.toMatch(/^[0-9a-f]{8}-/)
  })

  it('and falls back to the broker, who is also a name', () => {
    const who = showingOwner({ assigned_broker: 'Fabio de Castro' }, 'bc')
    expect(who?.name).toBe('Fabio de Castro')
  })

  it('never hands back the uuid that started this', () => {
    const who = showingOwner({ assigned_credit_officer: UUID, assigned_broker: 'Fabio de Castro' }, 'bc')
    expect(who?.name).not.toBe(UUID)
  })
})
