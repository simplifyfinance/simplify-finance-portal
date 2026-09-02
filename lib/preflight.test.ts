import { describe, it, expect } from 'vitest'
import { preflight, peopleOnDeal, applicantNames, preflightHeadline } from './preflight'
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
})

describe('the check that runs before a handover prints', () => {
  const found = preflight(deal, compliance, cats)

  it('catches a name that is not on the file', () => {
    const f = found.find(x => x.kind === 'name' && x.box.startsWith('Primary reasons'))
    expect(f).toBeTruthy()
    expect(f!.issue).toContain('Richard Chapman')
    expect(f!.issue).toContain('Natasha Chapman')
    expect(f!.snippet).toContain('Richard')
  })

  it('says when one box names two different people', () => {
    const f = found.find(x => x.kind === 'name' && x.box === 'Borrowing power')
    expect(f!.issue).toContain('in the same box')
  })

  it('catches the TBA left in the security box', () => {
    const f = found.find(x => x.kind === 'placeholder')
    expect(f!.box).toBe('Security (property)')
    expect(f!.words).toContain('TBA')
  })

  it('catches the unanswered HEM rows', () => {
    const f = found.find(x => x.kind === 'hem')
    expect(f!.issue).toContain('Health insurance and Strata (primary residence)')
  })

  it('does not invent problems in a clean box', () => {
    expect(found.some(x => x.box === 'Deposit / equity')).toBe(false)
  })

  it('flags an applicant nobody has asked the risk questions', () => {
    // Every joint deal has one of these until the file is reopened: compliance
    // dropped the second applicant, so nothing was ever recorded for them.
    const both = { ...compliance, applicants: [{ name: 'Natasha Chapman' }, { name: 'Richard Chapman' }],
                   risks: { 'Natasha Chapman': { hasWill: 'Yes' } } }
    const f = preflight(deal, both, []).find(x => x.kind === 'risks')
    expect(f!.severity).toBe('stop')
    expect(f!.issue).toContain('Richard Chapman')
    expect(f!.issue).not.toContain('Natasha Chapman')
  })

  it('says nothing about risks once everyone has been asked', () => {
    const both = { ...compliance, applicants: [{ name: 'A B' }], risks: { 'A B': { hasWill: 'Yes' } } }
    expect(preflight({}, both, []).some(x => x.kind === 'risks')).toBe(false)
  })

  it('says nothing at all about a clean file', () => {
    const clean = { applicants: [{ name: 'Natasha Chapman' }], depositComment: 'All confirmed.',
                    risks: { 'Natasha Chapman': { hasWill: 'Yes' } },
                    expenses: { healthInsurance: { monthlyAmount: '301', hem: 'in' },
                                primaryResidenceBodyCorp: { monthlyAmount: '0', hem: 'in' } } }
    expect(preflight({ clients: { first_name: 'Natasha', last_name: 'Chapman' } }, clean, cats)).toEqual([])
    expect(preflightHeadline([])).toBe('')
  })

  it('does not match a name inside a longer word', () => {
    const d2 = { clients: { first_name: 'Ann', last_name: 'Lee' } }
    const c2 = { applicants: [{ name: 'Bob Smith' }], depositComment: 'Settlement is on the anniversary date.' }
    expect(preflight(d2, c2, []).some(f => f.kind === 'name')).toBe(false)
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
