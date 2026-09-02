// WHAT IS ON THE HANDOVER, AS DATA.
//
// The handover and the fact find existed only as PDFs, and a PDF is a bad place
// to copy from: text extraction inserts hard line breaks mid-sentence, splits
// words across lines with a hyphen, and throws the bold away. Fabio, 2 Sep 2026,
// asked for "one big flow with copy buttons" instead, so the same content now
// has to render twice - once to paper and once to a screen with a Copy button on
// every box.
//
// So the content stops living inside the renderers. This module says what the
// boxes ARE; the PDF routes and the handover screen both draw it.
//
// The three constants below were each defined twice before this - once in
// ComplianceForm and once in the compliance PDF - with a comment in the PDF
// claiming they were "the same list the Compliance screen uses". They were
// copies. They happened to still agree on 2 Sep 2026; nothing was keeping them
// that way, and the screen would have made a third copy.
import { money, moneyOrBlank, withFrequency, readMoney } from './money'
import { notWorking, selfEmployed, currentEmployment, fullName,
         annualIncome, stillToConfirm, dateAU } from './fact-find'
import { parseBlocks, hasContent, NEEDS_BOXES, COMMENT_BOXES, type Block, type Box } from './handover'
import { titleSummary } from './title'
import { hemStateOf, hemTotals, unansweredNote, type ExpenseCategory } from './hem'
import { rowLegalFeeLabel } from './lender-fees'

// --- the lists ---------------------------------------------------------------

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { key: 'groceries', label: 'Groceries', inHem: true },
  { key: 'clothingPersonalCare', label: 'Clothing and personal care', inHem: true },
  { key: 'petCare', label: 'Pet care', inHem: true },
  { key: 'phoneInternetSubscriptions', label: 'Phone, internet and subscriptions', inHem: true },
  { key: 'other', label: 'Other', inHem: true },
  { key: 'privateSchoolingTuition', label: 'Private schooling and tuition', inHem: false },
  { key: 'childcare', label: 'Childcare', inHem: true },
  { key: 'publicEducation', label: 'Public education', inHem: true },
  { key: 'higherEducationTraining', label: 'Higher education and training', inHem: true },
  { key: 'recreationEntertainment', label: 'Recreation and entertainment', inHem: true },
  { key: 'sicknessAccidentLifeInsurance', label: 'Sickness, accident and life insurance', inHem: false },
  { key: 'medicalHealth', label: 'Medical and health', inHem: true },
  { key: 'healthInsurance', label: 'Health insurance', inHem: true, askHem: true },
  { key: 'generalBasicInsurances', label: 'General basic insurances', inHem: true },
  { key: 'transport', label: 'Transport', inHem: true },
  { key: 'secondaryResidenceRunningCosts', label: 'Secondary residence running costs', inHem: false },
  { key: 'primaryResidenceRunningCosts', label: 'Primary residence running costs', inHem: true },
  { key: 'investmentPropertyRunningCosts', label: 'Investment property running costs', inHem: true },
  // Australia says strata. The KEY stays - it is written into every deal already
  // assessed - so only the word on the page changes.
  { key: 'primaryResidenceBodyCorp', label: 'Strata (primary residence)', inHem: true, askHem: true },
  { key: 'childSpousalMaintenance', label: 'Child and spousal maintenance', inHem: false },
  { key: 'rent', label: 'Rent', inHem: true },
  { key: 'board', label: 'Board', inHem: true },
]

export type Group = { title: string; note?: string; rows: { key: string; label: string }[] }

// Exactly the groups on the Risks tab, in the order they appear there. Fabio,
// 2 Sep 2026, seeing invented group names on the first draft: "why no answesrs
// on this??" - the names have to match the screen or the answers look missing.
export const RISK_GROUPS: Group[] = [
  { title: 'Financial situation', rows: [
    { key: 'adverseChanges', label: 'Adverse changes to financial situation?' },
    { key: 'beneficialChanges', label: 'Beneficial changes to financial situation?' },
  ]},
  { title: 'Exit strategy', rows: [
    { key: 'retirementAge', label: 'Retirement age' },
    { key: 'repaymentMethod', label: 'Repayment method' },
  ]},
  { title: 'Financial security', rows: [
    { key: 'financialExperience', label: 'Level of financial experience' },
    { key: 'interestRateConcern', label: 'Concern about interest rate movements' },
    { key: 'loanFlexibility', label: 'Importance of loan flexibility (offset/redraw)' },
    { key: 'jobSecurity', label: 'Concern about job security' },
    { key: 'propertyValueConcern', label: 'Concern about property value fluctuations' },
    { key: 'emergencyFund', label: 'Emergency fund / liquid asset or insurance for loss of income?' },
    { key: 'maintainLifestyle', label: 'Maintain commitments if partner unable to earn?' },
    { key: 'adequateInsurance', label: 'Adequate insurance for loan repayments if unable to work?' },
    { key: 'hasWill', label: 'Do you have a will?' },
    { key: 'circumstancesImpact', label: 'Any circumstances that may impact financial commitments?' },
  ]},
  { title: 'Credit history', note: "Team must answer — from the client's declarations", rows: [
    { key: 'creditImpairment', label: 'Any credit impairment?' },
    { key: 'creditEnquiries', label: 'Recent credit enquiries?' },
  ]},
]

export const PRODUCT_GROUPS: Group[] = [
  { title: 'Rate type', rows: [
    { key: 'variableRate', label: 'Variable rate' },
    { key: 'fixedRate', label: 'Fixed rate' },
    { key: 'fixedAndVariable', label: 'Fixed and variable rate' },
  ]},
  { title: 'Repayment type', rows: [
    { key: 'principalAndInterest', label: 'Principal and interest' },
    { key: 'interestOnly', label: 'Interest only' },
    { key: 'interestInAdvance', label: 'Interest in advance' },
  ]},
  { title: 'Product type', rows: [
    { key: 'lineOfCredit', label: 'Line of credit' },
    { key: 'offsetAccount', label: 'Offset account' },
    { key: 'redraw', label: 'Redraw' },
  ]},
  { title: 'What is important to you', rows: [
    { key: 'lowestCost', label: 'Lowest overall loan cost' },
    { key: 'approvedQuickly', label: 'Loan approved quickly' },
    { key: 'specificFeatures', label: 'Specific loan features' },
    { key: 'lenderPolicy', label: 'Lender policy / borrowing capacity' },
  ]},
  { title: 'Branch access', rows: [
    { key: 'branchAccess', label: 'Branch access required' },
  ]},
  { title: 'Other', rows: [
    { key: 'otherRequirements', label: 'Other requirements' },
  ]},
]

// --- the model ---------------------------------------------------------------

export type Accent = 'ink' | 'blue' | 'teal' | 'violet' | 'green' | 'slate' | 'navy' | 'amber' | 'red'
export type Tone = 'plain' | 'warn' | 'good'

export type ViewRow =
  | { kind: 'kv'; k: string; v: string; state?: 'in' | 'out' | 'unanswered' }
  | { kind: 'sub'; text: string }

export type ViewCard = {
  key: string          // stable, and what a saved tick is filed under
  title: string
  // Whether the whole card can be copied in one go. Only the written boxes can:
  // they go into ONE SalesTrekker field, so one button fills one field. A card
  // of key/value rows is a dozen separate fields, and a button that puts all
  // twelve on the clipboard cannot paste into any of them. Fabio, 2 Sep 2026:
  // "remove copy of flields as copying multiple tabs doesnt work and it will
  // confuse staff". Those rows copy one at a time instead.
  copyable?: boolean
  no?: number          // the SalesTrekker box number, where there is one
  tag?: string
  tone?: Tone
  blocks?: Block[]     // prose, bold already resolved out of the markdown
  rows?: ViewRow[]
  note?: string        // an amber line under the content
}

export type ViewSection = {
  key: string; title: string; pill?: string; accent: Accent; cards: ViewCard[]
  // Which half of the SalesTrekker menu this belongs to. See ORDER.
  group?: 'Client profile' | 'Home loan'
}

const words = (v: any) => {
  const t = String(v || '').replace(/_/g, ' ').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}

// Start and end are two separate rows, not one "From Mar 2019" line. They are
// two separate fields in SalesTrekker, and a value with a word in front of it
// cannot be pasted into either of them.
const dates = (from: any, to: any): [string, any][] =>
  [['Start date', dateAU(from)], ['End date', dateAU(to)]]

const owners = (ownership: any, applicants: any[]): string =>
  (applicants || []).filter((a: any) => {
    const v = ownership?.[a.id]
    return v === 'Yes' || (Number(v) || 0) > 0
  }).map((a: any) => fullName(a)).join(', ')

// Empty rows are dropped rather than printed as dashes: a screen of dashes reads
// as data lost, and a dash is not something anybody wants to paste.
const kv = (pairs: [string, any][]): ViewRow[] =>
  pairs.filter(([, v]) => String(v ?? '').trim() !== '')
       .map(([k, v]) => ({ kind: 'kv', k, v: String(v) } as ViewRow))

const sub = (text: string): ViewRow => ({ kind: 'sub', text })

// WHAT GETS COPIED.
//
// Plain text, laid out the way somebody would type it into SalesTrekker:
// paragraphs separated by a blank line, no markdown asterisks, no hyphens left
// over from a line break. This is the whole point of the screen - it is the one
// thing a PDF cannot give you.
export function copyTextOf(card: ViewCard): string {
  if (card.blocks) {
    return card.blocks
      .map(b => (b.kind === 'rule' ? '' : b.runs.map(r => r.text).join('')))
      .filter(Boolean)
      .join('\n\n')
  }
  const out: string[] = []
  for (const r of card.rows || []) {
    if (r.kind === 'sub') { out.push('', r.text.toUpperCase()) }
    else out.push(`${r.k}: ${r.v}`)
  }
  return out.join('\n').trim()
}

// --- the handover: the boxes that are typed into SalesTrekker ----------------

export function handoverSections(deal: any): ViewSection[] {
  const c = deal?.compliance_data || {}
  const applicants: string[] = (c.applicants || [])
    .map((a: any) => String(a?.name || '').trim()).filter(Boolean)
  const risks = c.risks || {}
  const productReqs = c.productReqs || {}
  const expenses = c.expenses || {}

  const ownershipText = titleSummary(c.title, applicants)
  const textFor = (b: Box) => (b.key === '__title' ? ownershipText : String(c[b.key] || ''))

  // Numbered across both groups, continuously, exactly as the PDF numbers them -
  // box 7 on the screen has to be box 7 on the paper or the two cannot be used
  // side by side.
  let n = 0
  const boxCard = (b: Box): ViewCard | null => {
    const text = textFor(b)
    if (!hasContent(text)) return null
    n += 1
    return {
      key: b.key, no: n, title: b.label, blocks: parseBlocks(text), copyable: true,
      // A pre-approval is why the security box says TBA. Saying so on the box
      // stops somebody "fixing" it.
      ...(b.key === 'securityComment' && c.preApproval
        ? { tag: 'Pre-approval', tone: 'warn' as Tone } : {}),
    }
  }

  const needs = NEEDS_BOXES.map(boxCard).filter(Boolean) as ViewCard[]
  const comments = COMMENT_BOXES.map(boxCard).filter(Boolean) as ViewCard[]

  // Security and ownership are pulled out of the broker comments and put with
  // Security details, where SalesTrekker asks for them. The numbers do NOT
  // change when a box moves: a number names the box, not its position, so the
  // screen and the PDF still agree that box 9 is Security.
  const SECURITY_KEYS = ['securityComment', '__title']
  const security = comments.filter(c => SECURITY_KEYS.includes(c.key))
  const written = comments.filter(c => !SECURITY_KEYS.includes(c.key))

  const boxPill = (n: number) => `${n} ${n === 1 ? 'box' : 'boxes'}`
  const sections: ViewSection[] = []
  if (needs.length) sections.push({ key: 'needs', title: 'Needs and objectives', accent: 'ink',
    pill: boxPill(needs.length), cards: needs })
  if (security.length) sections.push({ key: 'security', title: 'Security details', accent: 'ink',
    pill: boxPill(security.length), cards: security })
  if (written.length) sections.push({ key: 'broker', title: 'Compliance comments', accent: 'ink',
    pill: boxPill(written.length), cards: written })

  // Risks: every applicant, every time. An applicant with no answers gets one
  // honest sentence rather than nineteen dashes.
  const riskCards: ViewCard[] = applicants.map(name => {
    const r = risks[name] || {}
    const answered = RISK_GROUPS.some(g => g.rows.some(x => String(r[x.key] || '').trim()))
    if (!answered) {
      return { key: `risks:${name}`, title: name,
        note: `No risk answers have been recorded for ${name}. Nothing has been lost — these questions have not been asked yet, and the lender will want them.`,
        rows: [] }
    }
    const rows: ViewRow[] = []
    for (const g of RISK_GROUPS) {
      rows.push(sub(g.note ? `${g.title} — ${g.note}` : g.title))
      rows.push(...g.rows.map(x => ({ kind: 'kv', k: x.label, v: String(r[x.key] || '—') } as ViewRow)))
    }
    return { key: `risks:${name}`, title: name, rows }
  })
  if (riskCards.length) sections.push({ key: 'risks', title: 'Risks', accent: 'red',
    pill: applicants.length > 1 ? 'both applicants' : 'applicant', cards: riskCards })

  const prodRows: ViewRow[] = []
  for (const g of PRODUCT_GROUPS) {
    prodRows.push(sub(g.title))
    prodRows.push(...g.rows.map(x => ({ kind: 'kv', k: x.label, v: String(productReqs[x.key] || '—') } as ViewRow)))
  }
  sections.push({ key: 'product', title: 'Product requirements', accent: 'navy', cards: [
    { key: 'product', title: 'What the clients asked for', rows: prodRows },
  ]})

  // Living expenses, with the HEM flag carried through. A category nobody has
  // answered the in/out question for is marked, not guessed.
  const totals = hemTotals(EXPENSE_CATEGORIES, expenses)
  const expRows: ViewRow[] = []
  for (const cat of EXPENSE_CATEGORIES) {
    const entry = (expenses as any)[cat.key]
    const state = hemStateOf(cat, entry)
    const amount = readMoney(entry?.monthlyAmount) || 0
    if (!amount && state !== 'unanswered') continue
    expRows.push({ kind: 'kv', k: cat.label, state,
      v: `${money(amount)} · ${state === 'unanswered' ? 'needs a HEM answer' : state === 'in' ? 'in HEM' : 'outside HEM'}` })
  }
  expRows.push(sub('Totals'))
  expRows.push({ kind: 'kv', k: 'Total expenses', v: money(totals.all) })
  expRows.push({ kind: 'kv', k: 'In HEM', v: money(totals.inHem), state: 'in' })
  expRows.push({ kind: 'kv', k: 'Not in HEM', v: money(totals.notInHem), state: 'out' })
  sections.push({ key: 'expenses', title: 'Expenses', accent: 'green', pill: 'household monthly', cards: [
    { key: 'expenses', title: 'Monthly expenses', tag: money(totals.all), rows: expRows,
      note: totals.unanswered > 0 ? unansweredNote(totals.unanswered) : undefined },
  ]})

  return sections
}

// --- the fact find: everything the lender will ask for ------------------------

export function factFindSections(deal: any): ViewSection[] {
  const ff = deal?.fact_find_data || {}
  const bc = deal?.bc_data || {}
  const lo = deal?.lo_data || {}
  const applicants: any[] = ff.applicants || []
  const loanAmount = readMoney(deal?.loan_amount)
  const lvr = readMoney(bc.lvrPercent) ?? null

  const out: ViewSection[] = []

  out.push({ key: 'applicants', title: 'Applicants', accent: 'blue',
    pill: `${applicants.length}${ff.dependants ? ` · ${ff.dependants} dependants` : ''}`,
    cards: applicants.map((a, i) => {
      return {
        key: `applicant:${a.id || i}`, tag: `Applicant ${i + 1}`,
        title: [a.title, fullName(a)].filter(Boolean).join(' ') || `Applicant ${i + 1}`,
        rows: kv([
          ['Date of birth', dateAU(a.dob)],
          ['Gender', a.gender], ['Preferred name', a.preferredName], ['Previous name', a.previousName],
          ['Mobile', a.phoneMobile], ['Email', a.emailPersonal],
        ]),
      }
    })})

  out.push({ key: 'address', title: 'Address history', accent: 'teal',
    cards: applicants.map((a, i) => {
      const rows: ViewRow[] = []
      for (const ad of a.addresses || []) {
        rows.push(sub(ad.isCurrent ? 'Current' : 'Previous'))
        rows.push(...kv([
          ['Address', ad.address], ['Status', ad.residentialStatus],
          ...dates(ad.startDate, ad.endDate),
          // Only a renter or boarder is asked this, so an owner gets no row
          // rather than a "not recorded" that reads as a gap.
          ['Housing expense', /rent|board/i.test(String(ad.residentialStatus || ''))
            ? (withFrequency(ad.housingExpenseAmount, ad.housingExpenseFrequency) || 'not recorded') : ''],
        ]))
      }
      return { key: `address:${a.id || i}`, title: fullName(a) || `Applicant ${i + 1}`, rows,
        note: rows.length ? undefined : 'No address recorded.' }
    })})

  out.push({ key: 'employment', title: 'Employment', accent: 'violet',
    cards: applicants.map((a, i) => {
      const rows: ViewRow[] = []
      for (const e of a.employment || []) {
        rows.push(sub([e.employmentPriority, e.isCurrent ? 'Current' : 'Previous'].filter(Boolean).join(' · ')))
        // Not working is an answer. Nothing further is asked of it.
        rows.push(...(notWorking(e)
          ? kv([['Employment type', 'Not working'], ['Occupation', e.occupation]])
          : kv([
              ['Employment type', e.employmentType], ['Occupation', e.occupation],
              ['Basis', e.employmentBasis],
              [selfEmployed(e) ? 'Business' : 'Employer', e.employerName],
              ['ABN', e.employerAbn], ['ACN', e.employerAcn], ['Employer type', e.employerType],
              ['Employer address', e.employerAddress],
              ...dates(e.startDate, e.endDate),
              ['On probation', e.onProbation ? 'Yes' : ''],
              ['Contact', [e.contactPersonName, e.contactPersonDetails].filter(Boolean).join(' — ')],
            ])))
      }
      return { key: `employment:${a.id || i}`, title: fullName(a) || `Applicant ${i + 1}`, rows,
        note: rows.length ? undefined : 'No employment recorded.' }
    })})

  out.push({ key: 'income', title: 'Income', accent: 'green', pill: 'annualised',
    cards: applicants.map((a, i) => {
      const total = annualIncome(a)
      const jobs = currentEmployment(a)
      const idle = jobs.length > 0 && jobs.every(notWorking)
      const rows: ViewRow[] = []
      for (const inc of a.income || []) {
        if ((a.income || []).length > 1) rows.push(sub(String(inc.incomeType || 'Income')))
        rows.push(...kv([
          ['Gross base salary', withFrequency(inc.grossSalary, inc.grossSalaryFrequency)],
          ['Bonus', withFrequency(inc.bonusAmount, inc.bonusFrequency)],
          ['Overtime (essential)', withFrequency(inc.overtimeEssentialAmount, inc.overtimeEssentialFrequency)],
          ['Overtime (non-essential)', withFrequency(inc.overtimeNonEssentialAmount, inc.overtimeNonEssentialFrequency)],
          ['Commission', withFrequency(inc.commissionAmount, inc.commissionFrequency)],
          ['Allowances', withFrequency(inc.allowanceAmount, inc.allowanceFrequency)],
          ['Business', inc.seBusinessName], ['ABN', inc.seAbn],
          ['Assessment method', inc.seAssessmentMethod],
          ['Director salary', withFrequency(inc.seDirectorSalary, inc.seDirectorSalaryFrequency)],
          ['Other income', inc.otherIncomeType
            ? withFrequency(inc.otherIncomeAmount, 'annually') + ` (${inc.otherIncomeType})` : ''],
        ]))
      }
      if (total > 0) rows.push({ kind: 'kv', k: 'Total, annualised', v: money(total) })
      return {
        key: `income:${a.id || i}`, title: fullName(a) || `Applicant ${i + 1}`,
        tag: total > 0 ? money(total) : undefined, rows,
        note: idle && total === 0
          ? 'Not working, so no income is expected. Recorded on the fact find as an answer, not as a gap.'
          : rows.length ? undefined : 'No income recorded.',
      }
    })})

  const assets: any[] = ff.assets || []
  out.push({ key: 'assets', title: 'Assets', accent: 'slate', pill: String(assets.length),
    cards: assets.map((a, i) => ({
      key: `asset:${i}`, title: [a.assetType, a.description].filter(Boolean).join(' — ') || 'Asset',
      tag: moneyOrBlank(a.value) || undefined,
      rows: kv([
        ['Value', moneyOrBlank(a.value)],
        ['BSB / account', [a.bsb, a.accountNumber].filter(Boolean).join(' · ')],
        ['Registration', a.regNumber], ['Membership', a.membershipNumber],
        ['Owned by', owners(a.ownership, applicants)],
      ]),
    }))})

  const properties: any[] = ff.properties || []
  out.push({ key: 'properties', title: 'Properties', accent: 'violet', pill: String(properties.length),
    cards: properties.map((p, i) => {
      const rows: ViewRow[] = kv([
        ['Ownership type', p.ownershipType], ['Future use', p.futureUse],
        ['Property subtype', p.propertySubtype], ['Zoning', p.zoning],
        ['Value', moneyOrBlank(p.value)], ['Valuation method', p.valuationMethod],
        ['RP Data estimate', money(p.rpDataEstimatedValue)],
        ['Running costs', withFrequency(p.runningCosts, p.runningCostsFrequency)],
        ['Strata', withFrequency(p.bodyCorpAmount, p.bodyCorpFrequency)],
        ['Rental income', withFrequency(p.rentalIncome, p.rentalIncomeFrequency)],
        ['Owned by', owners(p.ownership, applicants)],
      ])
      for (const l of p.loans || []) {
        rows.push(sub('Linked loan'))
        rows.push(...kv([
          ['Lender', l.lenderName], ['Mortgage type', l.mortgageType],
          ['BSB / account', [l.bsb, l.accountNumber].filter(Boolean).join(' · ')],
          ['Limit', money(l.limitAmount)], ['Balance', moneyOrBlank(l.balance)],
          ['Interest rate', l.interestRate ? `${l.interestRate}%` : ''],
          ['Repayment', [withFrequency(l.repaymentAmount, l.repaymentFrequency), l.repaymentType].filter(Boolean).join(' · ')],
          ['Rate type', l.rateType],
          ['Interest only expires', dateAU(l.interestOnlyExpiryDate)],
          ['Loan term expires', dateAU(l.loanTermExpiryDate)],
          ['Remaining term', l.remainingLoanTermYears ? `${l.remainingLoanTermYears} years` : ''],
          ['Status', l.status], ['Owned by', owners(l.ownership, applicants)],
        ]))
      }
      return { key: `property:${i}`, title: p.address || `Property ${i + 1}`,
               tag: moneyOrBlank(p.value) || undefined, rows }
    })})

  const liabilities: any[] = ff.liabilities || []
  out.push({ key: 'liabilities', title: 'Liabilities', accent: 'red',
    pill: 'excludes property-linked loans',
    cards: liabilities.map((l, i) => ({
      key: `liability:${i}`, title: [l.liabilityType, l.lenderName].filter(Boolean).join(' — ') || 'Liability',
      tag: moneyOrBlank(l.balance) || undefined,
      rows: kv([
        ['Account', l.accountNumber],
        ['Limit', money(l.limitAmount)], ['Balance', moneyOrBlank(l.balance)],
        ['Repayment', withFrequency(l.repaymentAmount, l.repaymentFrequency)],
        ['Status', l.status], ['Owned by', owners(l.ownership, applicants)],
      ]),
    }))})

  const scenario: ViewRow[] = kv([
    ['Template', words(bc.template)], ['State', bc.dutyState], ['Suburb', bc.suburb],
    ['Property type', bc.propertyType], ['Loan term', bc.loanTerm ? `${bc.loanTerm} years` : ''],
  ])
  scenario.push(sub('Figures'))
  scenario.push(...kv([
    ['Purchase price', money(bc.purchasePrice) || money(bc.newPurchasePrice)],
    ['Deposit', money(bc.deposit) ? `${money(bc.deposit)}${bc.depositSource ? ` (${bc.depositSource})` : ''}` : ''],
    ['Stamp duty', money(bc.stampDuty)],
    ['Existing loan balance', money(bc.existingLoanBal)],
    ['Property value', money(bc.propertyValue)],
    ['Equity release', money(bc.equityRelease)],
    ['Land value', money(bc.landValue)], ['Construction cost', money(bc.constructionCost)],
    ['"As if complete" valuation', money(bc.asIfCompleteValue)],
    ['Loan amount', loanAmount !== null ? money(loanAmount) : ''],
    ['LVR', lvr ? `${lvr}%${lvr <= 80 ? ' (no LMI)' : ''}` : ''],
    ['LMI', money(bc.lmi)],
  ]))
  if ((bc.splits || []).length) {
    scenario.push(sub('Loan splits'))
    scenario.push(...(bc.splits || []).map((sp: any, i: number) => ({
      kind: 'kv', k: sp.label || `Split ${i + 1}`,
      v: [money(sp.amount), sp.rate ? `${sp.rate}%` : '', sp.type,
          sp.repayment ? `${money(sp.repayment)} monthly` : ''].filter(Boolean).join(' · '),
    } as ViewRow)))
  }
  out.push({ key: 'bc', title: 'Funding worksheet', accent: 'navy', pill: words(bc.template),
    cards: [{ key: 'bc', title: 'Scenario', tag: lvr ? `${lvr}% LVR` : undefined, rows: scenario }]})

  // The recommendation leads, as it does in the lending options email the client
  // already read.
  const loLenders = (lo.lenders || []).filter((l: any) => l.lenderName)
  const isRec = (l: any) => !!lo.recommendedLender && l.lenderName === lo.recommendedLender
  const sorted = [...loLenders].sort((x, y) => (isRec(x) ? -1 : 0) - (isRec(y) ? -1 : 0))
  const loCards: ViewCard[] = []
  if (lo.recommendedLender && lo.recommendationNote) {
    loCards.push({ key: 'lo:note', title: `Our recommendation — ${lo.recommendedLender}`,
      tag: 'Recommended', tone: 'warn', copyable: true, blocks: parseBlocks(lo.recommendationNote) })
  }
  sorted.forEach((l: any, i: number) => {
    const rate = (m: any) => m?.enabled
      ? [`${m.rate}% p.a.`, m.repayment ? `${money(m.repayment)} monthly` : '',
         m.loanTerm ? `${m.loanTerm} years` : ''].filter(Boolean).join(' · ')
      : ''
    loCards.push({
      key: `lo:${l.lenderName}`, title: [l.lenderName, l.productName].filter(Boolean).join(' — '),
      tag: isRec(l) ? 'Recommended' : `Option ${i + 1}`, tone: isRec(l) ? 'warn' : 'plain',
      rows: kv([
        ['Variable P&I', rate(l.variablePI)], ['Variable IO', rate(l.variableIO)],
        ['Fixed P&I', rate(l.fixedPI)], ['Fixed IO', rate(l.fixedIO)],
        ['Application fee', money(l.applicationFee)], ['Annual fee', money(l.annualFee)],
        ['Valuation fee', money(l.valuationFee)], [rowLegalFeeLabel(l), money(l.legalFee)],
        ['Discharge fee', money(l.dischargeFee)],
        ['Offset account', l.offsetAccount], ['Approval', l.approvalDays],
        ['Note', l.specialNote],
      ]),
    })
  })
  if (loCards.length) out.push({ key: 'lo', title: 'Compare products', accent: 'amber',
    pill: `${loLenders.length} lenders compared`, cards: loCards })

  // A section with nothing in it is noise on a screen somebody is working down.
  return out.filter(s => s.cards.length > 0)
}

// THE ORDER OF THE PAGE.
//
// It is SalesTrekker's own left-hand menu, top to bottom: Client profile first
// (the applicant, then what they own, owe and earn), then Home loan. Fabio,
// 2 Sep 2026, with a screenshot of that menu: "lets match the order how the
// link is structured... essentially fact find comes first now".
//
// Somebody loading a deal works down one menu with the other open beside it, so
// the two lists have to run in the same direction. A section named here that a
// deal has nothing for simply does not appear.
const ORDER: { key: string; group: ViewSection['group'] }[] = [
  { key: 'applicants',  group: 'Client profile' },
  { key: 'address',     group: 'Client profile' },
  { key: 'employment',  group: 'Client profile' },
  { key: 'assets',      group: 'Client profile' },
  { key: 'properties',  group: 'Client profile' },
  { key: 'liabilities', group: 'Client profile' },
  { key: 'income',      group: 'Client profile' },
  { key: 'expenses',    group: 'Client profile' },
  { key: 'needs',       group: 'Client profile' },
  { key: 'risks',       group: 'Client profile' },
  { key: 'product',     group: 'Client profile' },
  { key: 'security',    group: 'Home loan' },
  { key: 'bc',          group: 'Home loan' },
  { key: 'lo',          group: 'Home loan' },
  { key: 'broker',      group: 'Home loan' },
]

export function allSections(deal: any): ViewSection[] {
  const built = new Map<string, ViewSection>()
  for (const sec of [...handoverSections(deal), ...factFindSections(deal)]) built.set(sec.key, sec)

  const out: ViewSection[] = []
  for (const { key, group } of ORDER) {
    const sec = built.get(key)
    if (sec) { out.push({ ...sec, group }); built.delete(key) }
  }
  // Anything a future change adds and forgets to place still shows up, at the
  // end, rather than disappearing off the page unnoticed.
  for (const sec of built.values()) out.push(sec)
  return out
}

// The boxes somebody actually presses a button on. The key/value cards are read
// and copied a value at a time, so counting them would make a 24-box job look
// like a 60-box one.
export function copyableCards(sections: ViewSection[]): ViewCard[] {
  return sections.flatMap(s => s.cards).filter(c => c.copyable)
}

export function countCards(sections: ViewSection[]): number {
  return copyableCards(sections).length
}

// The gaps, so the screen can say why something cannot be copied: because nobody
// has answered it, not because the page dropped it.
export function outstanding(deal: any): string[] {
  return stillToConfirm(deal)
}
