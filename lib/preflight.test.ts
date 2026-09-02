import { describe, it, expect } from 'vitest'
import { preflight, peopleOnDeal, applicantNames, preflightHeadline, singularPronounsIn } from './preflight'
import { defaultHolders, holdersFor, borrowerNotOnTitle, nobodyOnTitle,
         reasonRequired, titleSummary } from './title'
import { type ExpenseCategory } from './hem'

// The Chapman file, 2 Sep 2026. Two people in the deal name, one recorded as an
// applicant, and the text swapping between them.
const deal = {
  deal_name: 'Natasha_Chapman_Richard_Chapman_Purchase_2026',
  clients: { first_name: 'Natasha', last_name: 'Chapman' },
  fact_find_data: { applicants: [{ firstName: 'Natasha', lastName: 'Chapman' }, { firstName: 'Richard', lastName: 'Chapman' }] },
}
const compliance: any = {
  applicants: [{ name: 'Natasha Chapman' }],
  needsPrimary: 'With a base income of $446,428.63, Richard has strong servicing capacity, and the offset facility provides flexibility.',
  borrowingPowerComment: 'Richard Chapman has demonstrated a strong capacity to service the proposed loan. Subject to confirmation, it is not anticipated that any credit card liability would materially impact serviceability given the strength of Natasha’s income profile.',
  // Fabio's real Chapman text: opens plural, then drifts into one woman.
  needsImmediate: 'Clients are purchasing an owner-occupied property. The offset account will allow clients to reduce their interest costs by parking surplus funds against her loan balance, providing flexibility should she have upcoming expenses within the next two years.',
  securityComment: 'TBA — owner-occupied residential property, NSW.',
  depositComment: 'Our clients are purchasing a property for $5,250,000 with a loan of $1,700,000.',
  expenses: { healthInsurance: { monthlyAmount: '301' }, primaryResidenceBodyCorp: { monthlyAmount: '0' } },
}
const cats: ExpenseCategory[] = [
  { key: 'groceries', label: 'Groceries', inHem: true },
  { key: 'healthInsurance', label: 'Health insurance', inHem: true, askHem: true },
  { key: 'primaryResidenceBodyCorp', label: 'Strata (primary residence)', inHem: true, askHem: true },
]

describe('who the deal knows about', () => {
  it('gathers every person named anywhere on the file', () => {
    const people = peopleOnDeal(deal, compliance)
    expect(people).toContain('Natasha Chapman')
    expect(people).toContain('Richard Chapman')
  })
  it('knows which of them are actually applicants', () => {
    expect(applicantNames(compliance)).toEqual(['Natasha Chapman'])
  })

  it('finds the singular pronouns in a piece of writing', () => {
    expect(singularPronounsIn('should she have upcoming expenses against her loan balance')).toEqual(['she', 'her'])
    expect(singularPronounsIn('The applicants and their savings')).toEqual([])
    expect(singularPronounsIn('The shed, the history and the others')).toEqual([])
  })
})

describe('the check that runs before a handover prints', () => {
  const joint = { ...compliance, applicants: [{ name: 'Natasha Chapman' }, { name: 'Richard Chapman' }],
                  risks: { 'Natasha Chapman': { hasWill: 'Yes' }, 'Richard Chapman': { hasWill: 'Yes' } } }
  const found = preflight(deal, joint, cats)

  it('catches a joint file written about one person', () => {
    // Fabio's Chapman text: "should she have upcoming expenses", "her actual
    // financial needs" - on a deal with two applicants.
    const f = found.find(x => x.kind === 'pronoun')
    expect(f).toBeTruthy()
    expect(f!.issue).toContain('they')
    expect(f!.words).toContain('her')
  })

  it('says nothing about a single applicant, where the singular is correct', () => {
    const solo = { applicants: [{ name: 'Natasha Chapman' }], risks: { 'Natasha Chapman': { hasWill: 'Yes' } },
                   depositComment: 'She is purchasing a property and her savings will fund the deposit.' }
    expect(preflight({}, solo, []).some(x => x.kind === 'pronoun')).toBe(false)
  })

  it('does not flag a joint file written properly', () => {
    const good = { applicants: [{ name: 'A B' }, { name: 'C D' }], risks: { 'A B': { hasWill: 'Yes' }, 'C D': { hasWill: 'Yes' } },
                   depositComment: 'The applicants are purchasing a property and their savings will fund the deposit.' }
    expect(preflight({}, good, []).some(x => x.kind === 'pronoun')).toBe(false)
  })

  it('does not match a pronoun inside a longer word', () => {
    const g = { applicants: [{ name: 'A B' }, { name: 'C D' }], risks: { 'A B': { hasWill: 'Yes' }, 'C D': { hasWill: 'Yes' } },
                depositComment: 'The shed and the history of the property were reviewed.' }
    expect(preflight({}, g, []).some(x => x.kind === 'pronoun')).toBe(false)
  })

  it('catches the TBA left in the security box', () => {
    const f = found.find(x => x.kind === 'placeholder')
    expect(f!.box).toBe('Security (property)')
    expect(f!.words).toContain('TBA')
  })

  it('leaves TBA alone on a pre-approval, where there is no property yet', () => {
    const pre = { ...joint, preApproval: true }
    expect(preflight(deal, pre, cats).some(x => x.kind === 'placeholder')).toBe(false)
  })

  it('still catches a TBA left anywhere else on a pre-approval', () => {
    const pre = { ...joint, preApproval: true, depositComment: 'Deposit source TBA.' }
    const f = preflight(deal, pre, cats).find(x => x.kind === 'placeholder')
    expect(f!.box).toBe('Deposit / equity')
  })

  it('catches the unanswered HEM rows', () => {
    const f = found.find(x => x.kind === 'hem')
    expect(f!.issue).toContain('Health insurance and Strata (primary residence)')
  })

  it('flags an applicant nobody has asked the risk questions', () => {
    const one = { ...compliance, applicants: [{ name: 'Natasha Chapman' }, { name: 'Richard Chapman' }],
                  risks: { 'Natasha Chapman': { hasWill: 'Yes' } } }
    const f = preflight(deal, one, []).find(x => x.kind === 'risks')
    expect(f!.severity).toBe('stop')
    expect(f!.issue).toContain('Richard Chapman')
  })

  it('says nothing at all about a clean file', () => {
    const clean = { applicants: [{ name: 'Natasha Chapman' }],
                    risks: { 'Natasha Chapman': { hasWill: 'Yes' } },
                    depositComment: 'All confirmed.',
                    expenses: { healthInsurance: { monthlyAmount: '301', hem: 'in' },
                                primaryResidenceBodyCorp: { monthlyAmount: '0', hem: 'in' } } }
    expect(preflight({ clients: { first_name: 'Natasha', last_name: 'Chapman' } }, clean, cats)).toEqual([])
    expect(preflightHeadline([])).toBe('')
  })

  it('counts what it found', () => {
    expect(preflightHeadline(found)).toMatch(/^\d+ things to check/)
  })
})

describe('who goes on the title', () => {
  const apps = ['Natasha Chapman', 'Richard Chapman']

  it('starts with everyone on, split evenly', () => {
    expect(defaultHolders(apps)).toEqual([
      { name: 'Natasha Chapman', onTitle: true, share: '50%' },
      { name: 'Richard Chapman', onTitle: true, share: '50%' },
    ])
    expect(defaultHolders(['Solo Buyer'])[0].share).toBe('100%')
  })

  it('reconciles against the live applicants, so adding one does not lose the answer', () => {
    const saved = { holders: [{ name: 'Richard Chapman', onTitle: true, share: '100%' }] }
    const rows = holdersFor(saved, apps)
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.name === 'Richard Chapman')!.share).toBe('100%')
  })

  it('spots a borrower who will not own the security', () => {
    const chapman = { holders: [
      { name: 'Natasha Chapman', onTitle: false, share: '0%' },
      { name: 'Richard Chapman', onTitle: true, share: '100%' }] }
    expect(borrowerNotOnTitle(chapman, apps)).toBe(true)
    expect(reasonRequired(chapman, apps)).toBe(true)
    expect(reasonRequired({ ...chapman, reason: 'She is his spouse and will live there.' }, apps)).toBe(false)
  })

  it('does not call a normal deal a mismatch', () => {
    expect(borrowerNotOnTitle({ holders: defaultHolders(apps) }, apps)).toBe(false)
    expect(borrowerNotOnTitle(undefined, apps)).toBe(false)
    expect(borrowerNotOnTitle(undefined, ['Solo Buyer'])).toBe(false)
  })

  it('treats nobody-on-title as an unfinished form, not a strategy', () => {
    const none = { holders: apps.map(name => ({ name, onTitle: false, share: '0%' })) }
    expect(nobodyOnTitle(none, apps)).toBe(true)
    expect(borrowerNotOnTitle(none, apps)).toBe(false)
  })

  it('flags the Chapman structure and stops when nobody has explained it', () => {
    const c = { ...compliance, title: { holders: [
      { name: 'Natasha Chapman', onTitle: false, share: '0%' },
      { name: 'Richard Chapman', onTitle: true, share: '100%' }] } }
    const f = preflight(deal, { ...c, applicants: apps.map(name => ({ name })) }, []).find(x => x.kind === 'title')
    expect(f!.severity).toBe('stop')
    expect(f!.issue).toContain('no reason recorded')
  })

  it('softens to a warning once the reason is written down', () => {
    const c = { ...compliance, applicants: apps.map(name => ({ name })), title: {
      holders: [{ name: 'Natasha Chapman', onTitle: false, share: '0%' },
                { name: 'Richard Chapman', onTitle: true, share: '100%' }],
      reason: 'She is his spouse and will live in the property.' } }
    const f = preflight(deal, c, []).find(x => x.kind === 'title')
    expect(f!.severity).toBe('warn')
  })

  it('writes the handover box as plain sentences', () => {
    const t = { holders: [{ name: 'Natasha Chapman', onTitle: false, share: '0%' },
                          { name: 'Richard Chapman', onTitle: true, share: '100%' }],
                reason: 'She is his spouse and will live in the property as her principal place of residence.',
                legalAdvice: 'not_required' as const }
    const s = titleSummary(t, apps)
    expect(s).toContain('**On title:** Richard Chapman (100%)')
    expect(s).toContain('**Borrowing:** Natasha Chapman and Richard Chapman')
    expect(s).toContain('principal place of residence')
    expect(s).toContain('**Independent legal advice:** not required.')
    expect(s).not.toContain('<')          // no markup - it has to paste
  })

  it('says so plainly when the reason is missing', () => {
    const t = { holders: [{ name: 'Natasha Chapman', onTitle: false, share: '0%' },
                          { name: 'Richard Chapman', onTitle: true, share: '100%' }] }
    expect(titleSummary(t, apps)).toContain('No reason has been recorded.')
  })
})

// TBA against the security is the one placeholder with an innocent explanation:
// a pre-approval has no property yet. Fabio, 2 Sep 2026: "TBA is not a warning".
describe('TBA on the security box', () => {
  const base = {
    applicants: [{ name: 'Richard Chapman' }],
    securityComment: 'TBA - owner-occupied residential property, NSW.',
  }

  it('is raised on a deal that is not marked as a pre-approval', () => {
    const f = preflight({}, base).filter(x => x.kind === 'placeholder')
    expect(f).toHaveLength(1)
    expect(f[0].words).toEqual(['TBA'])
  })

  it('offers to settle it on the spot instead of sending you to another tab', () => {
    const f = preflight({}, base).find(x => x.kind === 'placeholder')!
    expect(f.fix).toBe('preApproval')
  })

  it('says nothing once the deal is marked as a pre-approval', () => {
    const f = preflight({}, { ...base, preApproval: true }).filter(x => x.kind === 'placeholder')
    expect(f).toHaveLength(0)
  })

  it('still raises TBA left in another box, pre-approval or not', () => {
    const f = preflight({}, { ...base, preApproval: true, depositComment: 'Deposit TBC' })
      .filter(x => x.kind === 'placeholder')
    expect(f).toHaveLength(1)
    expect(f[0].box).toMatch(/Deposit/)
    // No one-click fix on that one: it is somebody meaning to come back.
    expect(f[0].fix).toBeUndefined()
  })
})
