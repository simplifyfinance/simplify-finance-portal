// THE FACT FIND, ON FABIO'S FORM.
import { dutyStateOf } from './duty-state'
//
// 24 Sep 2026. The Compliance tab's Fact Find button gave a coloured reading
// document. Fabio: "i want the same style coming out of the fact find button on
// compliance tab", and then "sorry need typeable boxes".
//
// So it is the same paper as the Personal Assessment Form - black bands, the
// grey question column down the left, columns across the page - and every box
// is still a box. Nothing was dropped: all eleven sections that were in the old
// document are here, in the same order.
//
// EVERYTHING HERE IS PURE. It takes what the deal holds and returns where every
// label and box goes. No pdf-lib, no fonts, no file - so the document is tested
// rather than looked at in a viewer and hoped over.

import type { Item, Line } from './assessment-form'
import { money, withFrequency, readMoney } from './money'
import { notWorking, selfEmployed, fullName, annualIncome, dateAU } from './fact-find'
import { loanFigureRows } from './lmi'
import { rowLegalFeeLabel } from './lender-fees'
import { lenderOnTheDeal } from './client-agreement'
import { isRecommended, recommendedFirst } from './recommended-option'
import { incomeKind, type IncomeKind } from './income-kind'
import { buysNothing } from './buying'

const txt = (v: any) => String(v ?? '').trim()

// A money box draws its own $ beside it, the way the paper form does, so the
// value inside is the bare figure.
const bare = (v: any) => money(v).replace(/^\$/, '')

// THE OLD DOCUMENT PRINTED "not recorded" WHERE A FIGURE WAS MISSING, because a
// dropped row on a reading document looks like data lost. On a FORM an empty
// box already says it, and says it better - it is the box somebody writes the
// answer into. So money() everywhere, never moneyOrBlank, or a value box comes
// out reading "$ not recorded".

// FOUR PROPERTY COLUMNS IS 83 POINTS EACH, and "Ravi Kishore, Priya Kishore"
// does not fit in 83 points - it printed as "Ravi Kishore, Priya Ki". The box
// still holds the whole thing, but a form that clips when it is printed is a
// form somebody misreads. In the grid the owners are first names.
export const shortOwners = (ownership: any, applicants: any[]): string =>
  (applicants || []).filter((a: any) => {
    const v = ownership?.[a.id]
    return v === 'Yes' || (Number(v) || 0) > 0
  }).map((a: any) => txt(a.firstName) || 'Applicant').join(', ')

export const owners = (ownership: any, applicants: any[]): string =>
  (applicants || []).filter((a: any) => {
    const v = ownership?.[a.id]
    return v === 'Yes' || (Number(v) || 0) > 0
  }).map((a: any) => fullName(a)).join(', ')

// MORE THAN THREE COLUMNS AND A FIGURE STOPS FITTING IN ITS BOX.
//
// The value area is 331 points wide. Three columns is 110 each, which holds
// "$1,120,000" with room to spare; five would be 66, which does not. So a long
// list becomes several blocks of three, each with its own heading row.
function blocks<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

type Cell = { text?: string; amount?: any; tall?: number }

// One row of the form: a question down the left, one box per column.
//
// A ROW WHERE EVERY COLUMN IS EMPTY IS NOT PRINTED. A page of empty boxes reads
// as a form nobody filled in, and hides the boxes that are genuinely waiting
// for an answer.
function row(name: string, label: string, cells: Cell[], sub?: string): Item | null {
  if (!cells.some(c => txt(c.text) || txt(c.amount))) return null
  return {
    kind: 'row', label, sub,
    cols: cells.map((c, i): Line[] => [[
      txt(c.amount)
        ? { name: `${name}.${i}`, value: bare(c.amount), money: true }
        : { name: `${name}.${i}`, value: txt(c.text), tall: c.tall },
    ]]),
  }
}

// The same, but never dropped - used where the box is there to be filled in
// rather than to be read.
function askRow(name: string, label: string, cols: number, values: string[] = [], tall?: number): Item {
  return {
    kind: 'row', label,
    cols: Array.from({ length: Math.max(1, cols) }, (_, i): Line[] =>
      [[{ name: `${name}.${i}`, value: txt(values[i]), tall }]]),
  }
}

const band = (title: string): Item => ({ kind: 'band', title })
const heads = (titles: string[]): Item => ({ kind: 'heads', titles })

// A block of rows, dropped entirely when every row in it came back empty, so a
// section with nothing in it does not print a heading over a blank.
function section(title: string, headings: string[] | null, rows: (Item | null)[]): Item[] {
  const real = rows.filter(Boolean) as Item[]
  if (!real.length) return []
  return [band(title), ...(headings ? [heads(headings)] : []), ...real]
}

export type FactFindFormInput = {
  factFind: any
  bc: any
  lo: any
  // Straight off the deal record.
  loanAmount: number | null
  lvr: number | null
  // What lib/fact-find.ts says is still missing.
  toConfirm: string[]
  loanPurpose?: string
  internalNotes?: string
}

export function factFindFormItems(input: FactFindFormInput): Item[] {
  const ff = input.factFind || {}
  const bc = input.bc || {}
  const lo = input.lo || {}
  const applicants: any[] = ff.applicants || []
  const who = applicants.length ? applicants.map((_, i) => `Applicant ${i + 1}`) : ['Applicant 1']
  const n = Math.max(1, applicants.length)
  const at = (i: number) => applicants[i] || {}
  const items: Item[] = []

  // -- 1. APPLICANTS ---------------------------------------------------------
  items.push(...section('Applicants', who, [
    row('app.name',  'Full name',      applicants.map(a => ({ text: fullName(a) }))),
    row('app.title', 'Title',          applicants.map(a => ({ text: txt(a.title) }))),
    row('app.pref',  'Preferred name', applicants.map(a => ({ text: txt(a.preferredName) }))),
    row('app.prev',  'Previous name',  applicants.map(a => ({ text: txt(a.previousName) }))),
    row('app.dob',   'Date of birth',  applicants.map(a => ({ text: dateAU(a.dob) }))),
    row('app.sex',   'Gender',         applicants.map(a => ({ text: txt(a.gender) }))),
    row('app.mob',   'Mobile',         applicants.map(a => ({ text: txt(a.phoneMobile) }))),
    row('app.email', 'Email',          applicants.map(a => ({ text: txt(a.emailPersonal) }))),
    txt(ff.dependants) ? askRow('app.deps', 'Dependants', 1, [txt(ff.dependants)]) : null,
  ]))

  // -- 2. ADDRESS HISTORY ----------------------------------------------------
  //
  // Current first, then each previous one as its own set of rows, so two
  // addresses in one column never read as one address.
  const addrOf = (a: any, current: boolean) =>
    (a.addresses || []).filter((x: any) => !!x.isCurrent === current)
  const mostPrevious = Math.max(0, ...applicants.map(a => addrOf(a, false).length))
  const addrRows = (pick: (a: any) => any, tag: string, k: string) => [
    row(`addr.${k}.line`, `${tag} address`, applicants.map(a => ({ text: txt(pick(a)?.address), tall: 26 }))),
    row(`addr.${k}.stat`, `${tag} - status`, applicants.map(a => ({ text: txt(pick(a)?.residentialStatus) }))),
    row(`addr.${k}.from`, `${tag} - start date`, applicants.map(a => ({ text: dateAU(pick(a)?.startDate) }))),
    row(`addr.${k}.to`,   `${tag} - end date`,   applicants.map(a => ({ text: dateAU(pick(a)?.endDate) }))),
    // Only a renter or a boarder is asked this, so a home owner gets no row
    // rather than a "not recorded".
    row(`addr.${k}.cost`, `${tag} - housing expense`, applicants.map(a => {
      const ad = pick(a)
      return { text: /rent|board/i.test(txt(ad?.residentialStatus))
        ? withFrequency(ad?.housingExpenseAmount, ad?.housingExpenseFrequency) : '' }
    })),
  ]
  items.push(...section('Address history', who, [
    ...addrRows(a => addrOf(a, true)[0], 'Current', 'cur'),
    ...Array.from({ length: mostPrevious }, (_, j) =>
      addrRows(a => addrOf(a, false)[j], `Previous ${mostPrevious > 1 ? j + 1 : ''}`.trim(), `p${j}`)).flat(),
  ]))

  // -- 3. EMPLOYMENT ---------------------------------------------------------
  const jobsOf = (a: any, current: boolean) =>
    (a.employment || []).filter((e: any) => !!e.isCurrent === current)
  const mostPrevJobs = Math.max(0, ...applicants.map(a => jobsOf(a, false).length))
  const jobRows = (pick: (a: any) => any, tag: string, k: string) => {
    // NOT WORKING IS AN ANSWER. Nothing further is asked of it - see the same
    // rule in lib/deal-facts.ts, after Natasha Chapman.
    const idle = (a: any) => notWorking(pick(a))
    return [
      row(`job.${k}.type`, `${tag} - employment type`, applicants.map(a =>
        ({ text: idle(a) ? 'Not working' : txt(pick(a)?.employmentType) }))),
      row(`job.${k}.occ`,  `${tag} - occupation`, applicants.map(a => ({ text: txt(pick(a)?.occupation) }))),
      row(`job.${k}.basis`,`${tag} - basis`, applicants.map(a => ({ text: idle(a) ? '' : txt(pick(a)?.employmentBasis) }))),
      row(`job.${k}.emp`,  `${tag} - employer or business`, applicants.map(a => {
        const e = pick(a)
        return { text: idle(a) ? '' : txt(e?.employerName) }
      }), applicants.some(a => selfEmployed(pick(a))) ? '(business where self-employed)' : undefined),
      row(`job.${k}.abn`,  `${tag} - ABN / ACN`, applicants.map(a =>
        ({ text: idle(a) ? '' : [txt(pick(a)?.employerAbn), txt(pick(a)?.employerAcn)].filter(Boolean).join(' / ') }))),
      row(`job.${k}.etype`,`${tag} - employer type`, applicants.map(a => ({ text: idle(a) ? '' : txt(pick(a)?.employerType) }))),
      row(`job.${k}.eaddr`,`${tag} - employer address`, applicants.map(a =>
        ({ text: idle(a) ? '' : txt(pick(a)?.employerAddress), tall: 26 }))),
      row(`job.${k}.from`, `${tag} - start date`, applicants.map(a => ({ text: dateAU(pick(a)?.startDate) }))),
      row(`job.${k}.to`,   `${tag} - end date`,   applicants.map(a => ({ text: dateAU(pick(a)?.endDate) }))),
      row(`job.${k}.prob`, `${tag} - on probation`, applicants.map(a => ({ text: pick(a)?.onProbation ? 'Yes' : '' }))),
      row(`job.${k}.who`,  `${tag} - contact`, applicants.map(a =>
        ({ text: [txt(pick(a)?.contactPersonName), txt(pick(a)?.contactPersonDetails)].filter(Boolean).join(' - ') }))),
    ]
  }
  items.push(...section('Employment', who, [
    ...jobRows(a => jobsOf(a, true)[0], 'Current', 'cur'),
    ...Array.from({ length: mostPrevJobs }, (_, j) =>
      jobRows(a => jobsOf(a, false)[j], `Previous ${mostPrevJobs > 1 ? j + 1 : ''}`.trim(), `p${j}`)).flat(),
  ]))

  // -- 4. INCOME -------------------------------------------------------------
  const incOf = (a: any, j: number) => (a.income || [])[j] || {}
  const mostIncomes = Math.max(1, ...applicants.map(a => (a.income || []).length))
  // A ROW BELONGS TO THE KIND OF INCOME IT IS ABOUT.
  //
  // 28 Oct 2026, on Nader Gharsa's fact find. The compliance team were sent a
  // sheet saying a PAYG client's "Assessment method" was "Last 2 financial
  // years", and the same against his Centrelink payment. He has never been
  // self-employed.
  //
  // Nobody typed it. EVERY income row the fact find creates is born carrying
  // seAssessmentMethod: 'Last 2 financial years' because that is the first
  // option in a dropdown the form only ever shows to self-employed people. The
  // form hides the box. This document printed it.
  //
  // That is the whole fault, and it is not about one field. The FORM decides
  // what is relevant and the DOCUMENT did not: it printed every box that had a
  // value in it, and a default has a value. A blank box is obviously blank; a
  // default reads as an answer somebody gave.
  //
  // So every row now asks lib/income-kind.ts what this income actually is -
  // the same function the broker notes have used since September, and which
  // carries its own scars from the same default. PER CELL, not per row: two
  // applicants with different kinds of income share a row on this paper, and
  // one of them having a business is no reason to print a business against the
  // other one.
  //
  // Fabio, 28 Oct 2026: "why is the PDF being done and making stuff up?"
  const cellKind = (inc: any): IncomeKind => {
    const k = incomeKind(inc)
    // An income row nobody has filled in yet is laid out as PAYG, which is what
    // the paper looked like before this and what somebody writing on it by hand
    // expects. It has no values to lie with.
    return k === 'none' ? 'payg' : k
  }
  const incRows = (j: number) => {
    const tag = mostIncomes > 1 ? `Income ${j + 1} - ` : ''
    const kinds = applicants.map(a => cellKind(incOf(a, j)))
    // Print the row if it is about somebody's income; blank the cell of anybody
    // it is not about.
    const each = (k: string, label: string, forKind: IncomeKind | null, get: (inc: any) => any) => {
      if (forKind !== null && !kinds.includes(forKind)) return null
      return row(`inc.${j}.${k}`, `${tag}${label}`, applicants.map((a, i) =>
        ({ text: forKind === null || kinds[i] === forKind ? get(incOf(a, j)) : '' })))
    }
    return [
      mostIncomes > 1 ? each('type', 'type', null, inc => txt(inc.incomeType)) : null,
      each('base',  'Gross base salary', 'payg', inc => withFrequency(inc.grossSalary, inc.grossSalaryFrequency)),
      each('bonus', 'Bonus', 'payg', inc => withFrequency(inc.bonusAmount, inc.bonusFrequency)),
      each('oteN',  'Overtime (essential)', 'payg', inc => withFrequency(inc.overtimeEssentialAmount, inc.overtimeEssentialFrequency)),
      each('oteX',  'Overtime (non-essential)', 'payg', inc => withFrequency(inc.overtimeNonEssentialAmount, inc.overtimeNonEssentialFrequency)),
      each('comm',  'Commission', 'payg', inc => withFrequency(inc.commissionAmount, inc.commissionFrequency)),
      each('allow', 'Allowances', 'payg', inc => withFrequency(inc.allowanceAmount, inc.allowanceFrequency)),
      each('biz',   'Business', 'self-employed', inc => txt(inc.seBusinessName)),
      each('bizabn','Business ABN', 'self-employed', inc => txt(inc.seAbn)),
      each('method','Assessment method', 'self-employed', inc => txt(inc.seAssessmentMethod)),
      each('dir',   "Director's salary", 'self-employed', inc => withFrequency(inc.seDirectorSalary, inc.seDirectorSalaryFrequency)),
      each('other', 'Other income', 'other', inc => txt(inc.otherIncomeType)
        ? `${withFrequency(inc.otherIncomeAmount, 'annually')} (${txt(inc.otherIncomeType)})` : ''),
    ]
  }
  items.push(...section('Income', who, [
    ...Array.from({ length: mostIncomes }, (_, j) => incRows(j)).flat(),
    row('inc.total', 'Total, annualised', applicants.map(a => {
      const t = annualIncome(a)
      return { amount: t > 0 ? t : '' }
    })),
  ]))

  // -- 5. OTHER ASSETS -------------------------------------------------------
  for (const [b, group] of blocks<any>(ff.assets || [], 3).entries()) {
    items.push(...section(b === 0 ? 'Other assets' : 'Other assets (continued)',
      group.map((_, i) => `Asset ${b * 3 + i + 1}`), [
      row(`ast.${b}.type`, 'Type',          group.map(a => ({ text: txt(a.assetType) }))),
      row(`ast.${b}.desc`, 'Description',   group.map(a => ({ text: txt(a.description) }))),
      row(`ast.${b}.val`,  'Value',         group.map(a => ({ amount: money(a.value) }))),
      row(`ast.${b}.acct`, 'BSB / account', group.map(a => ({ text: [txt(a.bsb), txt(a.accountNumber)].filter(Boolean).join(' / ') }))),
      row(`ast.${b}.reg`,  'Registration',  group.map(a => ({ text: txt(a.regNumber) }))),
      row(`ast.${b}.mem`,  'Membership',    group.map(a => ({ text: txt(a.membershipNumber) }))),
      row(`ast.${b}.own`,  'Owned by',      group.map(a => ({ text: owners(a.ownership, applicants) }))),
    ]))
  }

  // -- 6. PROPERTIES ---------------------------------------------------------
  //
  // ACROSS THE PAGE, NOT DOWN IT, AND EACH PROPERTY KEEPS ITS OWN LOAN.
  //
  // Fabio, 24 Sep 2026: "why properties are like that and not side by side like
  // the settlement". They were: one property made one column, and one column is
  // the whole width, so it read as a list. And the loans had been lifted out
  // into a band of their own, which put a property in one place and its
  // mortgage in another.
  //
  // So this is the settlement form's own arrangement: FOUR columns always, the
  // way his paper does it, whether or not there are four properties - the empty
  // ones are there to be written in - and every loan sits in the column of the
  // property it is secured against.
  const props: any[] = ff.properties || []
  const PER_BAND = 4
  const bandCount = Math.max(1, Math.ceil(props.length / PER_BAND))
  // Repeat the loan questions as many times as the busiest property needs, and
  // no more. One loan each - which is nearly every deal - reads as one set.
  const mostLoans = Math.max(1, ...props.map(p => (p.loans || []).length))

  for (let b = 0; b < bandCount; b++) {
    const slice = Array.from({ length: PER_BAND }, (_, k) => props[b * PER_BAND + k] || {})
    const num = (k: number) => b * PER_BAND + k + 1
    items.push(band(b === 0 ? 'Properties' : 'Properties (continued)'))
    items.push(heads(slice.map((_, k) => `Property ${num(k)}`)))

    // A PROPERTY ROW IS ALWAYS PRINTED. Unlike the rest of this document these
    // are questions on a form, not facts being reported, so an empty one is a
    // box waiting for an answer rather than a line worth dropping.
    const prop = (key: string, label: string, get: (p: any) => Cell, sub?: string): Item => ({
      kind: 'row', label, sub,
      cols: slice.map((p, k): Line[] => {
        const c = get(p)
        return [[txt(c.amount)
          ? { name: `prp.${num(k)}.${key}`, value: bare(c.amount), money: true }
          : { name: `prp.${num(k)}.${key}`, value: txt(c.text), tall: c.tall }]]
      }),
    })

    items.push(
      prop('addr',  'Address',           p => ({ text: txt(p.address), tall: 36 })),
      prop('own',   'Ownership type',    p => ({ text: txt(p.ownershipType) })),
      prop('use',   'Future use',        p => ({ text: txt(p.futureUse) })),
      prop('sub',   'Property subtype',  p => ({ text: txt(p.propertySubtype) })),
      prop('zone',  'Zoning',            p => ({ text: txt(p.zoning) })),
      prop('val',   'Value',             p => ({ amount: money(p.value) })),
      // VALUATION METHOD AND RP DATA ESTIMATE ARE GONE. 28 Oct 2026, Fabio:
      // "on the valuation where it says estimated, I don't know where is that
      // getting that information. So remove that box completely because it
      // doesn't matter. It's just confusing people."
      //
      // He could not find where it came from because there was nowhere to look.
      // The fact find has no control for either of them. They existed only as
      // the value every new property is born with - 'Applicant estimate' - and
      // this document printed it as though somebody had chosen it. It also put
      // a sentence in the compliance pack: "The value is the applicants' own
      // estimate and will be confirmed by the lender's valuation." On every
      // deal. Said by nobody.
      prop('run',   'Running costs',     p => ({ text: withFrequency(p.runningCosts, p.runningCostsFrequency) })),
      prop('strata','Strata',            p => ({ text: withFrequency(p.bodyCorpAmount, p.bodyCorpFrequency) })),
      prop('rent',  'Rental income',     p => ({ text: withFrequency(p.rentalIncome, p.rentalIncomeFrequency) })),
      prop('owned', 'Owned by',          p => ({ text: shortOwners(p.ownership, applicants), tall: 26 })),
    )

    for (let j = 0; j < mostLoans; j++) {
      const tag = mostLoans > 1 ? `Loan ${j + 1} - ` : 'Loan - '
      const loan = (key: string, label: string, get: (l: any) => Cell): Item =>
        prop(`l${j}.${key}`, `${tag}${label}`, p => get((p.loans || [])[j] || {}))
      items.push(
        loan('who',   'lender',            l => ({ text: txt(l.lenderName) })),
        // A LOAN SECURED ON AN INVESTMENT PROPERTY IS AN INVESTMENT LOAN.
        //
        // 28 Oct 2026, Nader Gharsa again: the property is marked Investment and
        // both Pepper loans against it printed "Owner occupied". Nobody chose
        // that either - it is the value every new loan is born with, and the
        // only thing that could ever change it was somebody noticing.
        //
        // The property is the one that gets asked. It is the answer a person
        // actually gave, it cannot disagree with itself, and a loan cannot be
        // against an investment property for a different purpose than the
        // property it is against.
        prop(`l${j}.mtype`, `${tag}mortgage type`, p => ({ text: txt(p.ownershipType) })),
        loan('acct',  'BSB / account',     l => ({ text: [txt(l.bsb), txt(l.accountNumber)].filter(Boolean).join(' / '), tall: 26 })),
        loan('lim',   'limit',             l => ({ amount: money(l.limitAmount) })),
        loan('bal',   'balance',           l => ({ amount: money(l.balance) })),
        loan('rate',  'interest rate',     l => ({ text: txt(l.interestRate) ? `${txt(l.interestRate)}%` : '' })),
        loan('rep',   'repayment',         l => ({ text: withFrequency(l.repaymentAmount, l.repaymentFrequency), tall: 26 })),
        loan('rtype', 'rate type',         l => ({ text: txt(l.rateType) })),
        loan('ptype', 'repayment type',    l => ({ text: txt(l.repaymentType), tall: 26 })),
        loan('ioex',  'interest only expires', l => ({ text: dateAU(l.interestOnlyExpiryDate) })),
        loan('fxex',  'fixed rate expires',    l => ({ text: dateAU(l.fixedRateExpiryDate) })),
        loan('tmex',  'loan term expires',     l => ({ text: dateAU(l.loanTermExpiryDate) })),
        loan('left',  'remaining term',    l => ({ text: txt(l.remainingLoanTermYears) ? `${txt(l.remainingLoanTermYears)} yrs` : '' })),
        loan('stat',  'status',            l => ({ text: txt(l.status) })),
        loan('lown',  'owned by',          l => ({ text: shortOwners(l.ownership, applicants), tall: 26 })),
      )
    }
  }

  // -- 7. LIABILITIES --------------------------------------------------------
  for (const [b, group] of blocks<any>(ff.liabilities || [], 3).entries()) {
    items.push(...section(b === 0 ? 'Liabilities' : 'Liabilities (continued)',
      group.map((_, i) => `Liability ${b * 3 + i + 1}`), [
      row(`lia.${b}.type`, 'Type',          group.map(l => ({ text: txt(l.liabilityType) }))),
      row(`lia.${b}.who`,  'Lender',        group.map(l => ({ text: txt(l.lenderName) }))),
      row(`lia.${b}.acct`, 'Account',       group.map(l => ({ text: txt(l.accountNumber) }))),
      row(`lia.${b}.lim`,  'Limit',         group.map(l => ({ amount: money(l.limitAmount) }))),
      row(`lia.${b}.bal`,  'Balance',       group.map(l => ({ amount: money(l.balance) }))),
      row(`lia.${b}.rep`,  'Repayment',     group.map(l => ({ text: withFrequency(l.repaymentAmount, l.repaymentFrequency) }))),
      row(`lia.${b}.stat`, 'Status',        group.map(l => ({ text: txt(l.status) }))),
      row(`lia.${b}.owned`,'Owned by',      group.map(l => ({ text: owners(l.ownership, applicants) }))),
    ]))
  }

  // -- 8. BORROWING CAPACITY -------------------------------------------------
  const one = (name: string, label: string, text: string) => row(name, label, [{ text }])
  const oneAmount = (name: string, label: string, amount: any) => row(name, label, [{ amount }])
  // NOTHING IS BEING BOUGHT, SO NOTHING ABOUT A PURCHASE IS PRINTED.
  //
  // 28 Oct 2026. Nader's sheet carried "State VIC" and "Purchase price
  // $575,000" on a NSW refinance. That was a real scenario once - months ago,
  // before the deal became an equity release - and the figures never left the
  // record. The BC form stopped drawing those boxes the moment the scenario
  // changed; this document kept printing what was behind them.
  //
  // lib/buying.ts answers this once for the whole portal and already carries
  // the same scar: the compliance pack reads it so that a leftover purchase
  // price cannot put a purchase into a regulated document for a deal where
  // nothing is bought. The same rule, applied to the same figures, on paper.
  const buying = !buysNothing(bc.template)
  items.push(...section('Borrowing capacity', null, [
    one('bc.tpl',   'Scenario',      words(bc.template)),
    // The duty state. There is no duty where there is no purchase.
    buying ? one('bc.state', 'State', dutyStateOf(bc)) : null,
    one('bc.sub',   'Suburb',        txt(bc.suburb)),
    one('bc.ptype', 'Property type', txt(bc.propertyType)),
    one('bc.term',  'Loan term',     txt(bc.loanTerm) ? `${txt(bc.loanTerm)} years` : ''),
    buying ? oneAmount('bc.price', 'Purchase price', money(bc.purchasePrice) || money(bc.newPurchasePrice)) : null,
    buying ? one('bc.dep',   'Deposit', money(bc.deposit)
      ? `${money(bc.deposit)}${txt(bc.depositSource) ? ` (${txt(bc.depositSource)})` : ''}` : '') : null,
    buying ? oneAmount('bc.duty',  'Stamp duty',            money(bc.stampDuty)) : null,
    oneAmount('bc.exist', 'Existing loan balance', money(bc.existingLoanBal)),
    oneAmount('bc.pval',  'Property value',        money(bc.propertyValue)),
    oneAmount('bc.eq',    'Equity release',        money(bc.equityRelease)),
    oneAmount('bc.land',  'Land value',            money(bc.landValue)),
    oneAmount('bc.build', 'Construction cost',     money(bc.constructionCost)),
    oneAmount('bc.aic',   '"As if complete" valuation', money(bc.asIfCompleteValue)),
    // ONE ANSWER ABOUT THE LMI, EVERYWHERE. See lib/lmi.ts - the handover sheet
    // and this document print the same rows from the same function.
    ...loanFigureRows(bc, input.loanAmount, input.lvr ? `${input.lvr}%${input.lvr <= 80 ? ' (no LMI)' : ''}` : '')
      .map(([k, v], i) => one(`bc.lmi.${i}`, String(k), String(v ?? ''))),
    ...(bc.splits || []).map((sp: any, i: number) => one(`bc.split.${i}`, sp.label || `Split ${i + 1}`,
      [money(sp.amount), sp.rate ? `${sp.rate}%` : '', txt(sp.type),
       sp.repayment ? `${money(sp.repayment)} monthly` : ''].filter(Boolean).join(' - '))),
  ]))

  // -- 9. LENDING OPTIONS ----------------------------------------------------
  const lenders = (lo.lenders || []).filter((l: any) => txt(l.lenderName))
  const sorted = recommendedFirst(lo, lenders)
  // THE LENDER THE FILE IS PROCEEDING WITH. Fabio, 29 Sep 2026: "Always change
  // sentec to say we reocmmended whne client changes their mind". A client signs
  // this sheet, and naming a bank they are not borrowing from contradicts every
  // figure on it.
  const onTheDeal = lenderOnTheDeal(lo)
  if (onTheDeal && txt(lo.recommendationNote)) {
    items.push(band(`Our recommendation - ${onTheDeal}`))
    items.push(askRow('lo.note', '', 1, [txt(lo.recommendationNote)], 58))
  }
  const rateOf = (m: any) => m?.enabled
    ? [`${m.rate}% p.a.`, m.repayment ? `${money(m.repayment)} monthly` : '',
       m.loanTerm ? `${m.loanTerm} years` : ''].filter(Boolean).join(' - ')
    : ''
  for (const [b, group] of blocks<any>(sorted, 3).entries()) {
    items.push(...section(b === 0 ? 'Lending options' : 'Lending options (continued)',
      group.map((l, i) => isRecommended(lo, l) ? 'RECOMMENDED' : `Option ${b * 3 + i + 1}`), [
      row(`lo.${b}.who`,   'Lender',          group.map(l => ({ text: [txt(l.lenderName), txt(l.productName)].filter(Boolean).join(' - ') }))),
      row(`lo.${b}.vpi`,   'Variable P&I',    group.map(l => ({ text: rateOf(l.variablePI) }))),
      row(`lo.${b}.vio`,   'Variable IO',     group.map(l => ({ text: rateOf(l.variableIO) }))),
      row(`lo.${b}.fpi`,   'Fixed P&I',       group.map(l => ({ text: rateOf(l.fixedPI) }))),
      row(`lo.${b}.fio`,   'Fixed IO',        group.map(l => ({ text: rateOf(l.fixedIO) }))),
      row(`lo.${b}.app`,   'Application fee', group.map(l => ({ amount: money(l.applicationFee) }))),
      row(`lo.${b}.ann`,   'Annual fee',      group.map(l => ({ amount: money(l.annualFee) }))),
      row(`lo.${b}.val`,   'Valuation fee',   group.map(l => ({ amount: money(l.valuationFee) }))),
      row(`lo.${b}.legal`, rowLegalFeeLabel(group[0]), group.map(l => ({ amount: money(l.legalFee) }))),
      row(`lo.${b}.disc`,  'Discharge fee',   group.map(l => ({ amount: money(l.dischargeFee) }))),
      row(`lo.${b}.off`,   'Offset account',  group.map(l => ({ text: txt(l.offsetAccount) }))),
      row(`lo.${b}.days`,  'Approval',        group.map(l => ({ text: txt(l.approvalDays) }))),
      row(`lo.${b}.note`,  'Note',            group.map(l => ({ text: txt(l.specialNote), tall: 32 }))),
    ]))
  }

  // -- 10. LOAN PURPOSE AND NOTES -------------------------------------------
  const purpose = txt(input.loanPurpose || ff.loanPurpose)
  const notes = txt(input.internalNotes || ff.internalNotes)
  if (purpose || notes) {
    items.push(band('Loan purpose and notes'))
    if (purpose) items.push(askRow('np.purpose', 'Loan purpose', 1, [purpose], 58))
    if (notes)   items.push(askRow('np.notes',   'Sales notes', 1, [notes], 58))
  }

  // -- 11. STILL TO CONFIRM --------------------------------------------------
  //
  // Only fields the fact find actually asks for. An applicant marked Not
  // working is not asked for an employer, a basis or an income, and none of
  // those is listed here.
  if (input.toConfirm.length) {
    items.push(band(`Still to confirm (${input.toConfirm.length})`))
    items.push(askRow('todo.list', '', 1, [input.toConfirm.join('\n')],
      Math.min(180, 18 + input.toConfirm.length * 11)))
  }

  return items
}

// "oo_purchase" is not a word. Same tidy-up the old document did.
export function words(v: any): string {
  const t = String(v || '').replace(/_/g, ' ').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}

export { readMoney }
