// WHAT GOES IN EACH BOX OF THE PERSONAL ASSESSMENT FORM.
//
// The shape of the paper is in lib/assessment-form.ts. This is the mapping from
// a deal onto it: which fact find answer belongs in which box.
//
// Where the portal holds nothing, the box is EMPTY rather than absent. The
// paper form is what the team hands a client, and a section quietly missing
// because a deal is thin is worse than a blank line to write on.

import type { Item, Column, Line } from './assessment-form'

const s = (v: any) => (v === null || v === undefined) ? '' : String(v)
// Deliberately `any`. These lists come out of a jsonb column with no type at
// all, and a generic here infers `{}` and then refuses every field on it.
const first = (xs: any): any => (Array.isArray(xs) ? xs[0] : undefined)

const isCurrent  = (x: any) => !!x?.isCurrent
export const currentOf = (xs: any[]) => (xs || []).find(isCurrent) || (xs || [])[0]

// THE ONE THAT IS NOT THE CURRENT ONE.
//
// Filtering on `isCurrent` alone printed the same employer twice: a fact find
// with a single job often leaves the flag unset, so the only entry counted as
// both the current job and the previous one. Whatever `currentOf` picked is
// excluded by identity, which is true however the flag was left.
export const previousOf = (xs: any[]) => {
  const list = (xs || []).filter(Boolean)
  const cur = currentOf(list)
  return list.find(x => x !== cur)
}

// The basis radios on the paper are these four, whatever the fact find calls it.
export const BASIS = ['Full Time', 'Part Time', 'Casual', 'Self Employed']
export const MARITAL = ['Married', 'De facto', 'Single']

// The portal's own wording for a working arrangement, mapped onto the four
// words the paper form uses. Anything it does not recognise leaves the radios
// blank rather than guessing.
export function basisOf(emp: any): string {
  const raw = s(emp?.employmentBasis).toLowerCase()
  if (raw.includes('full')) return 'Full Time'
  if (raw.includes('part')) return 'Part Time'
  if (raw.includes('casual')) return 'Casual'
  if (raw.includes('self')) return 'Self Employed'
  if (s(emp?.employmentType).toLowerCase().includes('self')) return 'Self Employed'
  return ''
}

export function maritalOf(a: any): string {
  const raw = s(a?.relationshipStatus).toLowerCase()
  if (raw.includes('de facto') || raw.includes('defacto')) return 'De facto'
  if (raw.includes('married')) return 'Married'
  if (raw.includes('single')) return 'Single'
  return ''
}

// One asset line per type, the way the paper form asks for it.
export function assetValue(assets: any[], applicantId: string, match: RegExp): string {
  const hit = (assets || []).find(a =>
    match.test(s(a?.assetType)) && ownedBy(a, applicantId))
  return s(hit?.value)
}

export function ownedBy(item: any, applicantId: string): boolean {
  const raw = item?.ownership?.[applicantId]
  if (raw === undefined || raw === null) return false
  const v = s(raw).trim()
  if (v === '') return false
  if (v.toLowerCase() === 'yes') return true
  const n = Number(v.replace('%', ''))
  return Number.isFinite(n) && n > 0
}

export function liabilitiesOfType(liabs: any[], applicantId: string, match: RegExp): any[] {
  return (liabs || []).filter(l => match.test(s(l?.liabilityType)) && ownedBy(l, applicantId))
}

// A two-column row: Applicant 1 then Applicant 2, always both, because the
// paper form always has both.
const two = (build: (a: any, i: number) => Column, applicants: any[]): Column[] =>
  [0, 1].map(i => build(applicants[i] || {}, i))

const A = (i: number, f: string) => `a${i + 1}.${f}`

export type BuildInput = {
  factFind: any
  expenses?: Record<string, { monthlyAmount?: string }> | null
  // The portal's own expense categories, passed in rather than repeated here,
  // so the form can never drift from the list the Compliance tab asks.
  expenseCategories?: Array<{ key: string; label: string }>
  estimatedLoanAmount?: string
  notes?: string
}

// Money as typed, with the commas, turned into a number. '620,000' is text.
//
// ANYTHING WITH WORDS IN IT IS NOT A FIGURE. Stripping every character that is
// not a digit turns "about 400" into 400 and "approx 1-2k" into 12. A total
// that quietly includes a made-up number is worse than a total that is blank.
export function asNumber(v: any): number | null {
  const raw = s(v).trim()
  if (raw === '' || /[a-z]/i.test(raw)) return null
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function expensesTotal(
  expenses: Record<string, { monthlyAmount?: string }> | null | undefined,
  categories: Array<{ key: string }> | undefined,
): string {
  const keys = (categories || []).map(c => c.key)
  let any = false
  let total = 0
  for (const k of keys) {
    const n = asNumber(expenses?.[k]?.monthlyAmount)
    if (n !== null) { any = true; total += n }
  }
  // Nothing declared means nothing to total. A zero here would read as "we
  // checked and it is nought", which is a different claim.
  if (!any) return ''
  return total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function assessmentItems(input: BuildInput): Item[] {
  const ff = input.factFind || {}
  const applicants: any[] = Array.isArray(ff.applicants) ? ff.applicants : []
  const properties: any[] = Array.isArray(ff.properties) ? ff.properties : []
  const liabilities: any[] = Array.isArray(ff.liabilities) ? ff.liabilities : []
  const assets: any[] = Array.isArray(ff.assets) ? ff.assets : []
  const items: Item[] = []

  // ---- HOW CAN WE HELP YOU ------------------------------------------------
  items.push({ kind: 'band', title: 'How can we help you?' })
  items.push({ kind: 'row', label: 'Estimated loan amount',
    cols: [[[{ name: 'help.amount', value: s(input.estimatedLoanAmount), money: true }]]] })
  items.push({ kind: 'row', label: 'Loan purpose',
    cols: [[[{ name: 'help.purpose', value: s(ff.loanPurpose) }]]] })

  // ---- CONTACT DETAILS ----------------------------------------------------
  items.push({ kind: 'band', title: 'Contact details' })
  items.push({ kind: 'heads', titles: ['Applicant 1', 'Applicant 2'] })

  items.push({ kind: 'row', label: 'Name (as per photo ID)',
    cols: two((a, i) => [[{ name: A(i, 'name'), value: [a.firstName, a.lastName].filter(Boolean).join(' ') }]], applicants) })

  items.push({ kind: 'row', label: 'Date of birth',
    cols: two((a, i) => [[{ name: A(i, 'dob'), value: s(a.dob) }]], applicants) })

  items.push({ kind: 'row', label: 'Contact details',
    cols: two((a, i) => [
      [{ prefix: 'Mobile', name: A(i, 'mobile'), value: s(a.phoneMobile) }],
      [{ prefix: 'Email',  name: A(i, 'email'),  value: s(a.emailPersonal) }],
    ], applicants) })

  items.push({ kind: 'row', label: 'Current residential address',
    cols: two((a, i) => {
      const cur = currentOf(a.addresses || [])
      return [
        [{ name: A(i, 'addr.current'), value: s(cur?.address), tall: 34 }],
        [{ prefix: 'Since', name: A(i, 'addr.current.since'), value: s(cur?.startDate) }],
      ] as Column
    }, applicants) })

  items.push({ kind: 'row', label: 'Residential status',
    sub: 'eg: home owner, mortgage on home,\nrenting, living with parents, other',
    cols: two((a, i) => [[{ name: A(i, 'addr.status'), value: s(currentOf(a.addresses || [])?.residentialStatus) }]], applicants) })

  items.push({ kind: 'row', label: 'Previous residential address', sub: '(if less than 3 yrs)',
    cols: two((a, i) => {
      const prev = previousOf(a.addresses || [])
      return [
        [{ name: A(i, 'addr.prev'), value: s(prev?.address), tall: 34 }],
        [{ prefix: 'Since', name: A(i, 'addr.prev.since'), value: s(prev?.startDate) }],
      ] as Column
    }, applicants) })

  // ---- PERSONAL DETAILS ---------------------------------------------------
  items.push({ kind: 'band', title: 'Personal details' })
  items.push({ kind: 'heads', titles: ['Applicant 1', 'Applicant 2'] })

  items.push({ kind: 'row', label: 'Marital status',
    cols: two((a, i) => [[{ name: A(i, 'marital'), radio: MARITAL, value: maritalOf(a) }]], applicants) })

  items.push({ kind: 'row', label: 'Ages of dependants',
    cols: two((a, i) => [[{ name: A(i, 'dependants'), value: i === 0 ? s(ff.dependants) : '' }]], applicants) })

  items.push({ kind: 'row', label: 'Occupation',
    cols: two((a, i) => [[{ name: A(i, 'occupation'), value: s(currentOf(a.employment || [])?.occupation) }]], applicants) })

  items.push({ kind: 'row', label: 'Current employer',
    cols: two((a, i) => {
      const e = currentOf(a.employment || [])
      return [
        [{ prefix: 'Name',  name: A(i, 'emp.name'),  value: s(e?.employerName) }],
        [{ prefix: 'Since', name: A(i, 'emp.since'), value: s(e?.startDate) }],
        [{ name: A(i, 'emp.basis'), radio: BASIS, value: basisOf(e) }],
      ] as Column
    }, applicants) })

  items.push({ kind: 'row', label: 'Previous employer', sub: '(if less than 3yrs)',
    cols: two((a, i) => {
      const e = previousOf(a.employment || [])
      return [
        [{ prefix: 'Name', name: A(i, 'prev.name'), value: s(e?.employerName) }],
        [{ prefix: 'From', name: A(i, 'prev.from'), value: s(e?.startDate) },
         { prefix: 'to',   name: A(i, 'prev.to'),   value: s(e?.endDate) }],
        [{ name: A(i, 'prev.basis'), radio: BASIS, value: basisOf(e) }],
      ] as Column
    }, applicants) })

  items.push({ kind: 'row', label: 'Annual salary (excluding super)',
    cols: two((a, i) => [[{ name: A(i, 'salary'), value: s(first(a.income)?.grossSalary), money: true }]], applicants) })

  items.push({ kind: 'row', label: 'Other employment income',
    cols: two((a, i) => [[{ name: A(i, 'otherIncome'), value: '', money: true }]], applicants) })

  items.push({ kind: 'row', label: 'Other income type',
    cols: two((a, i) => [[{ name: A(i, 'otherIncomeType'), value: '' }]], applicants) })

  items.push({ kind: 'row',
    label: 'Are you aware of any foreseeable circumstances that will negatively impact your financial position?',
    cols: two((a, i) => [
      [{ name: A(i, 'foreseeable'), radio: ['Yes', 'No'], value: '' }],
      [{ name: A(i, 'foreseeable.detail'), value: '', tall: 40 }],
    ], applicants) })

  items.push({ kind: 'row', label: 'Residency status', sub: 'eg: Citizen',
    cols: two((a, i) => [[{ name: A(i, 'residency'), value: s(a.residencyStatus) }]], applicants) })

  // ---- FINANCIAL POSITION -------------------------------------------------
  // Properties run ACROSS the page, four to a band, the way the paper does it.
  items.push({ kind: 'band', title: 'Financial position' })
  const PER_BAND = 4
  const bands = Math.max(1, Math.ceil(Math.max(properties.length + 1, PER_BAND) / PER_BAND))
  for (let b = 0; b < bands; b++) {
    const slice = Array.from({ length: PER_BAND }, (_, k) => properties[b * PER_BAND + k] || {})
    const n = (k: number) => b * PER_BAND + k + 1
    items.push({ kind: 'heads', titles: slice.map((_, k) => `Asset ${n(k)}`) })

    const perProperty = (build: (p: any, k: number) => Line[]): Column[] => slice.map(build)

    items.push({ kind: 'row', label: '',
      cols: perProperty((p, k) => [[{ name: `p${n(k)}.use`, radio: ['Home', 'Investment'],
        value: /invest/i.test(s(p.ownershipType)) ? 'Investment' : (s(p.ownershipType) ? 'Home' : '') }]]) })

    items.push({ kind: 'row', label: 'Address',
      cols: perProperty((p, k) => [[{ name: `p${n(k)}.address`, value: s(p.address), tall: 36 }]]) })

    items.push({ kind: 'row', label: 'Estimated value',
      cols: perProperty((p, k) => [[{ name: `p${n(k)}.value`, value: s(p.value), money: true }]]) })

    items.push({ kind: 'row', label: 'Weekly rent received',
      cols: perProperty((p, k) => [[{ name: `p${n(k)}.rent`, value: s(p.rentalIncome), money: true }]]) })

    items.push({ kind: 'row', label: 'Monthly repayments',
      cols: perProperty((p, k) => [[{ name: `p${n(k)}.repay`, value: s(first(p.loans)?.repaymentAmount), money: true }]]) })

    items.push({ kind: 'row', label: 'Current loan limit',
      cols: perProperty((p, k) => [[{ name: `p${n(k)}.limit`, value: s(first(p.loans)?.limitAmount), money: true }]]) })

    items.push({ kind: 'row', label: 'Loan split used for',
      cols: perProperty((p, k) => {
        const l: any = first(p.loans) || {}
        const io = s(l.interestOnlyExpiryDate), fx = s(l.fixedRateExpiryDate)
        const note = io ? `IO expiry ${io}` : fx ? `Fixed expiry ${fx}` : ''
        return [[{ name: `p${n(k)}.splitFor`, value: note, tall: 30 }]]
      }) })

    items.push({ kind: 'row', label: 'Lender',
      cols: perProperty((p, k) => [[{ name: `p${n(k)}.lender`, value: s(first(p.loans)?.lenderName) }]]) })

    items.push({ kind: 'row', label: 'Interest rate - fixed / variable',
      cols: perProperty((p, k) => {
        const l: any = first(p.loans) || {}
        const rate = s(l.interestRate)
        const bits = [rate ? `${rate}%` : '', s(l.repaymentType).toLowerCase().includes('interest') ? 'IO' : '',
                      s(l.rateType).toLowerCase().startsWith('f') ? 'F' : s(l.rateType) ? 'V' : ''].filter(Boolean)
        return [[{ name: `p${n(k)}.rate`, value: bits.join(' ') }]]
      }) })

    items.push({ kind: 'row', label: 'Remaining loan term',
      cols: perProperty((p, k) => [[{ name: `p${n(k)}.term`, value: s(first(p.loans)?.remainingLoanTermYears) }]]) })

    items.push({ kind: 'row', label: 'Owned by',
      cols: perProperty((p, k) => [
        [{ prefix: 'Applicant 1', name: `p${n(k)}.own1`, value: s(p?.ownership?.[applicants[0]?.id] || '') }],
        [{ prefix: 'Applicant 2', name: `p${n(k)}.own2`, value: s(p?.ownership?.[applicants[1]?.id] || '') }],
      ]) })
  }

  // ---- OTHER ASSETS -------------------------------------------------------
  items.push({ kind: 'band', title: 'Other assets' })
  items.push({ kind: 'heads', titles: ['Applicant 1', 'Applicant 2'] })
  const assetRow = (label: string, key: string, match: RegExp, money = true) =>
    items.push({ kind: 'row', label,
      cols: two((a, i) => [[{ name: A(i, key), value: assetValue(assets, s(a.id), match), money }]], applicants) })

  assetRow('Superannuation balance', 'super',   /super|smsf/i)
  assetRow('Boats/caravans',         'boats',   /boat|caravan/i)
  items.push({ kind: 'row', label: 'Car (Value/Make/Model)',
    cols: two((a, i) => {
      const car = (assets || []).find(x => /vehicle|car|motor/i.test(s(x?.assetType)) && ownedBy(x, s(a.id)))
      return [[
        { name: A(i, 'car.value'), value: s(car?.value), money: true, grow: 1 },
        { name: A(i, 'car.make'),  value: s(car?.description), grow: 1 },
        { name: A(i, 'car.model'), value: '', grow: 1 },
      ]] as Column
    }, applicants) })
  assetRow('Shares',        'shares',   /share|equit/i)
  assetRow('Savings',       'savings',  /bank|saving|cash|offset/i)
  assetRow('Home contents', 'contents', /content|furniture/i)

  // ---- OTHER LIABILITIES --------------------------------------------------
  items.push({ kind: 'band', title: 'Other liabilities' })
  items.push({ kind: 'heads', titles: ['Applicant 1', 'Applicant 2'] })

  items.push({ kind: 'row', label: 'Weekly rental expenses', sub: '(if currently renting)',
    cols: two((a, i) => [[{ name: A(i, 'rentExp'),
      value: s(currentOf(a.addresses || [])?.housingExpenseAmount), money: true }]], applicants) })

  items.push({ kind: 'row', label: 'Credit card',
    cols: two((a, i) => {
      const cards = liabilitiesOfType(liabilities, s(a.id), /credit card/i)
      return Array.from({ length: 4 }, (_, k): Line => [
        { prefix: 'Lender', name: A(i, `cc${k + 1}.lender`), value: s(cards[k]?.lenderName), grow: 2 },
        { prefix: 'Limit',  name: A(i, `cc${k + 1}.limit`),  value: s(cards[k]?.limitAmount), money: true, grow: 1 },
      ])
    }, applicants) })

  const loanBlock = (label: string, key: string, match: RegExp) =>
    items.push({ kind: 'row', label,
      cols: two((a, i) => {
        const l = liabilitiesOfType(liabilities, s(a.id), match)[0]
        return [
          [{ prefix: 'Lender', name: A(i, `${key}.lender`), value: s(l?.lenderName) }],
          [{ prefix: 'Monthly Payment', name: A(i, `${key}.repay`), value: s(l?.repaymentAmount), money: true }],
          [{ prefix: 'Balance', name: A(i, `${key}.balance`), value: s(l?.balance), money: true, grow: 1 },
           { prefix: 'Limit',   name: A(i, `${key}.limit`),   value: s(l?.limitAmount), money: true, grow: 1 }],
        ] as Column
      }, applicants) })

  loanBlock('Personal loan / Car loan', 'ploan', /personal|car loan/i)
  loanBlock('Novated lease',            'lease', /novated|lease/i)

  items.push({ kind: 'row', label: 'HECS / HELP loan',
    cols: two((a, i) => [[{ prefix: 'Balance', name: A(i, 'hecs'),
      value: s(liabilitiesOfType(liabilities, s(a.id), /hecs|help/i)[0]?.balance), money: true }]], applicants) })

  // ---- MONTHLY LIVING EXPENSES -------------------------------------------
  // A COPY OF WHAT THE PORTAL HOLDS, not the paper form's own list.
  //
  // Fabio, 23 Sep 2026: "leave living expenses as a copy of whatever we
  // declared on the portal and not my form." The old paper list had rows the
  // portal never collects (fuel, tolls, coffee) and was missing several it
  // does, so the two could disagree about the same household. The assessment
  // is the one that goes to the lender, so the assessment wins.
  items.push({ kind: 'band', title: 'Monthly living expenses' })
  const exp = input.expenses || {}
  const cats = (input.expenseCategories || []).filter(c => c && c.key)
  for (let i = 0; i < cats.length; i += 2) {
    const left = cats[i]
    const right = cats[i + 1]
    items.push({ kind: 'row', label: left.label,
      cols: [
        [[{ name: `exp.${left.key}`, value: s(exp?.[left.key]?.monthlyAmount), money: true }]],
        right ? [[{ prefix: right.label, name: `exp.${right.key}`, value: s(exp?.[right.key]?.monthlyAmount), money: true }]] : [],
      ] })
  }
  items.push({ kind: 'row', label: 'Total monthly expenses',
    cols: [[[{ name: 'exp.total', value: expensesTotal(exp, cats), money: true }]]] })
  items.push({ kind: 'note',
    text: 'Please note: All banks have a benchmark for minimum living expenses to compare against your declared monthly expenses.' })
  items.push({ kind: 'note',
    text: 'As part of my compliance, the higher of the 2 figures will be used when determining your borrowing capacity.' })

  // ---- NOTES --------------------------------------------------------------
  items.push({ kind: 'band', title: 'Notes' })
  items.push({ kind: 'row', label: '',
    cols: [[[{ name: 'notes', value: s(input.notes || ff.internalNotes), tall: 150 }]]] })

  return items
}
