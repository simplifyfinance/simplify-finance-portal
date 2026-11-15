import { describe, it, expect } from 'vitest'
import {
  checkInsurance, lenderIsNoted, coversSettlement, askAboutInsurance, NOT_NOTED,
} from './the-insurance-check'
import { differences, notStated } from './a-checked-row'

const at = (f: string) => (rows: any[]) => rows.find(r => r.field === f)

describe('the lender has to be noted', () => {
  it('matches the same name', () => {
    expect(lenderIsNoted('CBA', 'CBA')).toBe(true)
  })

  it('and a longer written form of it', () => {
    expect(lenderIsNoted('Commonwealth Bank of Australia', 'Commonwealth Bank')).toBe(true)
    expect(lenderIsNoted('ING Bank (Australia) Limited', 'ING')).toBe(true)
  })

  // THE CAUTIOUS DIRECTION. An insurer's wording we cannot match goes to a
  // person rather than quietly passing.
  it('but an abbreviation it cannot match goes to a person', () => {
    expect(lenderIsNoted('Commonwealth Bank of Australia', 'CBA')).toBe(false)
  })

  it('and a blank box is never a pass', () => {
    expect(lenderIsNoted('', 'CBA')).toBe(false)
  })
})

describe('the cover has to outlast settlement', () => {
  it('an expiry after settlement is fine', () => {
    expect(coversSettlement('2027-08-04', '2026-11-28')).toBe(true)
  })

  it('an expiry before it is not', () => {
    expect(coversSettlement('2026-11-20', '2026-11-28')).toBe(false)
  })

  // SETTLEMENT DAY ITSELF IS NOT COVER. A policy that lapses on the day leaves
  // the lender unsecured for the day that matters.
  it('and an expiry on the day itself is not', () => {
    expect(coversSettlement('2026-11-28', '2026-11-28')).toBe(false)
  })

  // NOTHING IS INVENTED. With no date to compare, there is no finding.
  it('with nothing to compare it says nothing', () => {
    expect(coversSettlement('', '2026-11-28')).toBe(true)
    expect(coversSettlement('2027-08-04', '')).toBe(true)
    expect(coversSettlement('sometime next year', '2026-11-28')).toBe(true)
  })
})

describe('one certificate, checked', () => {
  const good = {
    insurer: 'Allianz', policyNumber: 'HBP-4417722',
    insured: '14 Marrack St, Kingswood NSW 2747',
    interestedParty: 'CBA', expires: '2027-08-04', kind: 'Building',
  }
  const want = {
    security: '14 Marrack St, Kingswood NSW 2747',
    lender: 'CBA', settlesOn: '2026-11-28', needs: 'building' as const,
  }

  it('passes a certificate with nothing wrong with it', () => {
    expect(differences(checkInsurance(good, want))).toHaveLength(0)
  })

  it('catches a policy over the wrong house', () => {
    const rows = checkInsurance({ ...good, insured: '9 Other Rd, Penrith NSW 2750' }, want)
    expect(at('insured')(rows).state).toBe('differs')
  })

  // THE SINGLE MOST COMMON REASON A SETTLEMENT IS PULLED.
  it('a blank interested party is a difference, not a silence', () => {
    const rows = checkInsurance({ ...good, interestedParty: '' }, want)
    const r = at('interestedParty')(rows)
    expect(r.says).toBe(NOT_NOTED)
    expect(r.state).toBe('differs')
    expect(askAboutInsurance(r)).toContain('has to be noted before settlement')
  })

  it('and a policy that lapses before settlement is a difference', () => {
    const rows = checkInsurance({ ...good, expires: '2026-11-01' }, want)
    expect(at('expires')(rows).state).toBe('differs')
    expect(askAboutInsurance(at('expires')(rows))).toContain('not past settlement')
  })

  it('an expiry it could not read says nobody stated it', () => {
    const rows = checkInsurance({ ...good, expires: '' }, want)
    expect(notStated(rows).map(r => r.field)).toContain('expires')
  })

  it('a strata certificate on a house is a difference', () => {
    const rows = checkInsurance({ ...good, kind: 'Strata' }, want)
    expect(at('kind')(rows).state).toBe('differs')
  })

  it('and on a unit it is the right document', () => {
    const rows = checkInsurance({ ...good, kind: 'Strata' },
      { ...want, needs: 'strata' as const })
    expect(at('kind')(rows).state).toBe('matches')
  })

  // THE PORTAL KNOWING A UNIT NEEDS STRATA IS NOT A FINDING ABOUT THE DOCUMENT.
  it('a certificate that does not name its own kind is not argued with', () => {
    const rows = checkInsurance({ ...good, kind: '' }, want)
    expect(rows.find(r => r.field === 'kind')).toBeUndefined()
  })

  // No lender recorded, nothing to say about who is noted.
  it('with no lender on the deal the interested party row is left out', () => {
    const rows = checkInsurance(good, { ...want, lender: '' })
    expect(rows.find(r => r.field === 'interestedParty')).toBeUndefined()
  })
})
