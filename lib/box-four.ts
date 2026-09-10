// BOX FOUR — ANALYSIS AND ASSESSMENT. COMPOSED, NOT GENERATED.
//
// The biggest box on the tab, and the one that invented the most. On the Chapman
// file it worked out a repayment of "$10,180 per month" when the lending options
// record $10,182 - a figure it calculated itself, against an instruction that
// says in capitals not to, leaving a client email and a compliance file two
// dollars apart with nobody having typed either. It also decided Richard was
// "assumed to have a reasonable to high level of financial literacy", which is a
// judgement about a client that nobody made.
//
// WHAT THIS BOX IS NOW. Fabio, 10 Sep 2026:
//
//   - Applicant education comes out entirely. "I don't wanna guess... I'm happy
//     to manage that from a compliance perspective on my side."
//   - It is a summary of what the client is trying to do and whether this loan
//     does it - "they're all statements. We're not really thinking outside the
//     box here."
//   - Around 500 words. Shorter than the 700 it was, and every line about THIS
//     deal rather than about deals in general.
//   - The retirement strategy appears on every file, whatever the ages, built
//     from the two answers on the Risks tab.
//   - Best interests and no conflicts of interest, always.
//   - No living expense figures - "that will be changed from time to time".
//   - Not the outstanding documents, and not that a valuation is the applicant's
//     own estimate. Both offered, both declined.

import { money, readMoney } from './money'
import { loanAmount, lvrOf, fundsToComplete } from './funds-to-complete'
import { splitsOf, dealRow } from './deal-structure'
import { fullName, currentEmployment, notWorking, selfEmployed, monthsBetween } from './fact-find'
import { annualIncomeOfApplicant } from './income-calculations'
import { applicantsOf } from './applicants'
import { variantOf, andList, structureOf, flexibilityPassage, type Gap } from './box-one'
import { retirementPicture } from './box-goals'
import { CREDIT_QUESTIONS } from './credit-history-facts'

const txt = (v: any) => String(v ?? '').trim()
const shout = (s: string) => `** ${s} **`

export type Box = { text: string; gaps: Gap[]; variant: 1 | 2 | 3 }

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const countInWords = (n: string) => COUNT[Number(txt(n))] ?? txt(n)
const TERM_WORDS: Record<string, string> = {
  '10': 'ten', '15': 'fifteen', '20': 'twenty', '25': 'twenty-five',
  '30': 'thirty', '35': 'thirty-five', '40': 'forty',
}
const termInWords = (t: string) => TERM_WORDS[txt(t)] || txt(t)
const article = (w: string) => /^[aeiou]/i.test(txt(w)) ? 'an' : 'a'

// HOW THEY SAID THEY WOULD CLEAR THE DEBT.
//
// The Risks tab records one of these against each applicant. Written out as a
// person would say it rather than as the dropdown label. "Other" was removed
// from that list on 10 Sep 2026 - nobody had ever chosen it, and an answer of
// "other" tells an assessor nothing.
export const REPAYMENT_METHOD_WORDS: Record<string, string> = {
  'Repayment of loan prior to retirement': 'intends to repay the loan in full before retiring',
  'Downsizing home': 'intends to repay the loan by downsizing the home',
  'Sale of assets': 'intends to repay the loan from the sale of assets',
  'Recurring income from superannuation': 'intends to meet the repayments from recurring superannuation income',
  'Superannuation lump sum following retirement': 'intends to repay the loan from a superannuation lump sum on retirement',
  'Savings': 'intends to repay the loan from savings',
  'Income from other investments': 'intends to meet the repayments from income from other investments',
  'Co-applicants income': "intends to rely on the co-applicant's income",
}

// ---------------------------------------------------------------------------
// THE RETIREMENT STRATEGY — on every file, whatever the ages
// ---------------------------------------------------------------------------

export function retirementStrategy(deal: any, v: 1 | 2 | 3): { parts: string[]; gaps: Gap[] } {
  const { term, people } = retirementPicture(deal)
  const parts: string[] = []
  const gaps: Gap[] = []
  const missing: string[] = []

  for (const p of people) {
    if (p.retiresAt === null) { missing.push(p.who); continue }
    const how = REPAYMENT_METHOD_WORDS[p.method] || ''
    parts.push(how
      ? `${p.who} has given a retirement age of ${p.retiresAt} and ${how}.`
      : `${p.who} has given a retirement age of ${p.retiresAt}. ${shout(`NOT RECORDED — how ${p.who} intends to repay the loan has not been recorded.`)}`)
    if (!how) gaps.push({ what: `Repayment method for ${p.who}`, where: 'Compliance → Risks → Exit strategy' })

    if (p.outlives && term !== null) {
      parts.push(shout([
        `EXIT STRATEGY — over a ${term} year term ${p.who} would be ${p.ageAtEnd} at the end of the loan, past that retirement age. An exit strategy is required and must be evidenced.`,
        `EXIT STRATEGY — the ${term} year term runs to ${p.who}'s age ${p.ageAtEnd}, beyond the retirement age recorded. This file needs an evidenced exit strategy.`,
        `EXIT STRATEGY — at the end of the ${term} year term ${p.who} would be ${p.ageAtEnd}, after the retirement age on the record. An exit strategy must be documented and evidenced.`,
      ][v - 1]))
      gaps.push({ what: `${p.who} retires before the loan ends — exit strategy required`, where: 'Compliance → Risks → Exit strategy' })
    } else if (term !== null && p.ageAtEnd !== null) {
      parts.push(`The ${term} year term runs to age ${p.ageAtEnd}, within that.`)
    }
  }

  if (missing.length) {
    parts.push(shout(`NOT RECORDED — no retirement age has been recorded for ${andList(missing)}, so the loan cannot be measured against retirement.`))
    gaps.push({ what: `Retirement age for ${andList(missing)}`, where: 'Compliance → Risks → Exit strategy' })
  }
  return { parts, gaps }
}

// ---------------------------------------------------------------------------
// CREDIT HISTORY — the five answers, as a sentence
// ---------------------------------------------------------------------------

// The order a person would say them in, which is not the order they sit on the
// form. Ending a clean credit history on "and has never been declared bankrupt"
// reads like an afterthought; it belongs first.
const CLEAN_ORDER = ['declaredBankrupt', 'unsatisfiedJudgements', 'problemsMeetingCommitments',
                     'simultaneousApplications', 'officerInLiquidation']
const CLEAN_WORDS: Record<string, string> = {
  declaredBankrupt: 'has never been declared bankrupt',
  unsatisfiedJudgements: 'has no unsatisfied judgements',
  problemsMeetingCommitments: 'has had no difficulty meeting fixed commitments',
  simultaneousApplications: 'has not applied to other credit providers simultaneously',
  officerInLiquidation: 'has not been an officer of a company placed in liquidation',
}
const RAISED_WORDS: Record<string, string> = {
  declaredBankrupt: 'has been declared bankrupt',
  unsatisfiedJudgements: 'has an unsatisfied judgement recorded',
  problemsMeetingCommitments: 'has had difficulty meeting fixed commitments',
  simultaneousApplications: 'has applied to other credit providers simultaneously',
  officerInLiquidation: 'has been an officer of a company placed in liquidation',
}

export function creditHistorySentences(deal: any): { parts: string[]; gaps: Gap[] } {
  const risks = deal?.compliance_data?.risks || {}
  const parts: string[] = []
  const gaps: Gap[] = []
  const noRow: string[] = []

  for (const a of applicantsOf(deal, deal?.bc_data || {})) {
    const r = risks[a.name]
    const first = a.name.split(' ')[0]
    if (!r) { noRow.push(first); continue }
    const raised: string[] = []
    const clean: string[] = []
    const blank: string[] = []
    for (const q of CREDIT_QUESTIONS) {
      const ans = txt((r as any)[q.key])
      if (!ans) { blank.push(q.label.toLowerCase()); continue }
      if (ans.toLowerCase() === 'no') clean.push(q.key)
      else raised.push(`${RAISED_WORDS[q.key] || q.label.toLowerCase()}${/discharged/i.test(ans) ? ', since discharged' : ''}`)
    }
    if (raised.length) {
      parts.push(`${first} ${andList(raised)}. This must be addressed with the lender.`)
      gaps.push({ what: `${first} has disclosed an adverse credit answer`, where: 'Compliance → Risks → Credit history' })
    }
    if (clean.length) {
      const said = CLEAN_ORDER.filter(k => clean.includes(k)).map(k => CLEAN_WORDS[k])
      parts.push(`${first} has confirmed that they ${said.map(x => x.replace(/^has /, 'have ')).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`)
    }
    if (blank.length) {
      parts.push(shout(`NOT RECORDED — ${andList(blank)} not answered for ${first}.`))
      gaps.push({ what: `Credit history not complete for ${first}`, where: 'Compliance → Risks → Credit history' })
    }
  }

  if (noRow.length) {
    parts.push(shout(`NOT RECORDED — no credit history answers have been recorded for ${andList(noRow)}.`))
    gaps.push({ what: `Credit history for ${andList(noRow)}`, where: 'Compliance → Risks → Credit history' })
  }
  return { parts, gaps }
}

// ---------------------------------------------------------------------------
// THE BOX
// ---------------------------------------------------------------------------

export function boxFour(deal: any): Box {
  const bc = deal?.bc_data || {}
  const lo = deal?.lo_data || {}
  const ff = deal?.fact_find_data || {}
  const cd = deal?.compliance_data || {}
  const row = dealRow(deal)
  const v = variantOf(deal?.id)
  const gaps: Gap[] = []

  const apps = applicantsOf(deal, bc)
  const whoFull = andList(apps.map(a => a.name))
  const who = andList(apps.map(a => a.name.split(' ')[0]))
  const plural = apps.length > 1

  // ===================== ANALYSIS =====================
  const analysis: string[] = []

  const amount = loanAmount(deal)
  const term = splitsOf(deal).map(s => txt(s.termYears)).find(Boolean) || txt(bc.loanTerm)
  const lvr = lvrOf(deal)
  const purchase = readMoney(bc.purchasePrice)
  const deposit = readMoney(bc.deposit)
  const isPurchase = /purchase|fhb|construction|bridging|buy/.test(txt(bc.template))

  let open = `${whoFull} ${plural ? 'are' : 'is'} borrowing ${amount > 0 ? money(amount) : shout('NOT RECORDED — no loan amount has been recorded')}`
  if (term) open += ` over a ${termInWords(term)} year term`
  open += isPurchase
    ? ` to purchase an owner-occupied property${txt(bc.suburb) ? ` in ${txt(bc.suburb)}` : ''}`
    : ` against ${txt(row.securityAddress) || 'the security recorded on this deal'}`
  if (purchase && purchase > 0) open += `, against a purchase price of ${money(purchase)}`
  if (deposit && deposit > 0) open += ` and a contribution of ${money(deposit)}`
  analysis.push(open + '.')

  if (lvr !== null) {
    analysis.push(lvr < 80
      ? `At a loan to value ratio of ${lvr}% no lenders mortgage insurance is payable.`
      : `The loan to value ratio is ${lvr}%.`)
  }
  if (cd.preApproval) analysis.push('This is a pre-approval and no security has been identified yet.')

  // --- the people ---
  const people: string[] = []
  for (const a of (ff.applicants || [])) {
    const name = fullName(a)
    if (!name) continue
    const first = name.split(' ')[0]
    const jobs = currentEmployment(a)
    const idle = jobs.length > 0 && jobs.every((e: any) => notWorking(e))
    const job = jobs.find((e: any) => !notWorking(e))
    if (idle || !job) {
      const occ = txt(jobs[0]?.occupation)
      people.push(`${first} is not working${occ ? `, with an occupation recorded as ${occ.toLowerCase()}` : ''}`)
      continue
    }
    const occ = txt(job.occupation).toLowerCase()
    const months = monthsBetween(job.startDate, job.endDate)
    const inc = annualIncomeOfApplicant(a)
    const bits = [`${first} is ${selfEmployed(job) ? 'self-employed' : 'employed'}${txt(job.employmentBasis) ? ` ${txt(job.employmentBasis).toLowerCase()}` : ''}`]
    if (occ) bits.push(`as ${article(occ)} ${occ}`)
    if (months > 0) bits.push(`and has held the role for ${months} month${months === 1 ? '' : 's'}`)
    let line = bits.join(' ')
    if (inc > 0) line += `, on a gross salary of ${money(inc)} a year`
    const prev = (a.employment || []).find((e: any) => !e?.isCurrent && txt(e?.endDate))
    if (prev) line += `, with a previous role ending in ${new Date(prev.endDate).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`
    people.push(line)
  }
  if (people.length) analysis.push(people.join('. ').replace(/^(.)/, c => c.toUpperCase()) + '.')

  const deps = txt(ff.dependants) || txt(bc.dependants)
  if (deps && deps !== '0') {
    analysis.push(`They have ${countInWords(deps)} dependant${deps === '1' ? '' : 's'}, whose ages are not recorded.`)
  }

  // --- what they own ---
  for (const p of (ff.properties || [])) {
    const addr = txt(p?.address)
    if (!addr) continue
    const val = readMoney(p?.value)
    const owing = (p?.loans || []).reduce((t: number, l: any) => t + (readMoney(l?.balance) ?? 0), 0)
    const lender = (p?.loans || []).map((l: any) => txt(l?.lenderName)).filter(Boolean)[0]
    const rate = (p?.loans || []).map((l: any) => txt(l?.interestRate)).filter(Boolean)[0]
    const sub = txt(p?.propertySubtype).toLowerCase()
    const selling = /sold|sell/i.test(txt(p?.futureUse))
    let line = `They own ${addr}${sub ? `, ${article(sub)} ${sub}` : ''}`
    if (selling) line += ', which the fact find records as being sold'
    if (val) line += `. It is valued at ${money(val)}`
    if (owing > 0) line += `, with ${money(owing)} owing${lender ? ` to ${lender}` : ''}${rate ? ` on a rate of ${rate}%` : ''}`
    analysis.push(line + '.')
  }

  const assets = (ff.assets || []).reduce((t: number, a: any) => t + (readMoney(a?.value) ?? 0), 0)
  const byType = (re: RegExp) => (ff.assets || [])
    .filter((a: any) => re.test(txt(a?.assetType)))
    .reduce((t: number, a: any) => t + (readMoney(a?.value) ?? 0), 0)
  if (assets > 0) {
    const bits: string[] = []
    const cash = byType(/bank|savings|cash|term deposit/i)
    const supr = byType(/super/i)
    const shares = byType(/share|investment/i)
    if (cash) bits.push(`${money(cash)} in bank accounts`)
    if (supr) bits.push(`${money(supr)} in superannuation`)
    if (shares) bits.push(`${money(shares)} in shares`)
    analysis.push(`Recorded assets total ${money(assets)}${bits.length ? ` — ${andList(bits)}` : ''}.`)
  }

  const liabilities = (ff.liabilities || []).length
  analysis.push(liabilities === 0
    ? 'No liabilities are recorded on the fact find, and full disclosure is required before serviceability can be relied upon.'
    : `${countInWords(String(liabilities)).replace(/^./, c => c.toUpperCase())} liabilit${liabilities === 1 ? 'y is' : 'ies are'} recorded on the fact find.`)

  const credit = creditHistorySentences(deal)
  analysis.push(...credit.parts)
  gaps.push(...credit.gaps)

  // ===================== ASSESSMENT =====================
  const assessment: string[] = []
  const s = structureOf(deal)

  assessment.push([
    `Serviceability has been assessed using ${s.lender || 'the lender'}'s own calculator, which applies their assessment rate and buffer, and on that basis servicing this loan is not expected to be a constraint.`,
    `Servicing has been tested on ${s.lender || 'the lender'}'s own calculator, which already carries their assessment rate and buffer, and the loan is not expected to be constrained by it.`,
    `${s.lender || 'The lender'}'s own calculator, which applies their assessment rate and buffer, has been used to assess serviceability, and on that basis the loan is not expected to be a constraint.`,
  ][v - 1])

  // the product, and what it does
  const rate = txt(lo.lenders?.find?.((l: any) => txt(l?.lenderName) === txt(lo.recommendedLender))?.variablePI?.rate
    || lo.lenders?.[0]?.variablePI?.rate)
  const repay = splitsOf(deal).map(x => txt(x.repaymentType)).find(Boolean)
  if (s.lender && s.product) {
    let line = `${s.lender}'s ${s.product} has been recommended`
    if (rate) line += `, on a variable rate of ${rate}%`
    if (repay) line += ` with ${repay.toLowerCase().includes('io') || /interest only/i.test(repay) ? 'interest only' : 'principal and interest'} repayments`
    if (term) line += ` over a ${termInWords(term)} year term`
    assessment.push(line + '.')
  }

  // what they said mattered - the one box that asks it
  const reqs: any = cd.productReqs || {}
  const wanted = Object.entries(reqs).filter(([, val]) => txt(val) === 'Important')
    .map(([k]) => PRODUCT_WORDS[k]).filter(Boolean)
  const refused = Object.entries(reqs).filter(([, val]) => txt(val) === 'Do not want')
    .map(([k]) => PRODUCT_WORDS[k]).filter(Boolean)
  if (wanted.length || refused.length) {
    const bits: string[] = []
    if (wanted.length) bits.push(`recorded ${andList(wanted)} as important to them`)
    // "did not want a line of credit and interest in advance" reads as one thing
    // they wanted. A negative list joins with "or".
    if (refused.length) bits.push(`did not want ${refused.length > 1
      ? refused.slice(0, -1).join(', ') + ' or ' + refused[refused.length - 1]
      : refused[0]}`)
    assessment.push(`The clients ${bits.join(', and ')}.`)
  }

  const flex = flexibilityPassage(s, who, v)
  if (flex) assessment.push(flex)

  // the fees, from the lender's own record
  const rec = (lo.lenders || []).find((l: any) => txt(l?.lenderName) === txt(lo.recommendedLender)) || (lo.lenders || [])[0] || {}
  const fees: string[] = []
  const fee = (label: string, val: any) => { const t = txt(val); if (t) fees.push(`${label} of ${/^\$/.test(t) ? t.replace(/\/yr$/, '') : '$' + t}`) }
  fee('an application fee', rec.applicationFee)
  fee('an annual fee', rec.annualFee)
  fee('a valuation fee', rec.valuationFee)
  fee('a legal fee', rec.legalFee)
  if (fees.length) {
    assessment.push(`The fees recorded against this product are ${andList(fees)}. Government charges are payable at settlement in addition to these and are not lender fees.`)
  }

  if (s.fixed) {
    assessment.push(`The fixed rate and the fixed period have been explained to the clients, including that repaying or refinancing the loan during the fixed period will attract a break cost, which is calculated by the lender at the time and cannot be quoted in advance.`)
  }

  if (txt(rec.approvalDays)) assessment.push(`${s.lender || 'The lender'}'s stated turnaround is ${txt(rec.approvalDays)}.`)

  const names: string[] = [...new Set<string>((lo.lenders || []).map((l: any) => txt(l?.lenderName)).filter(Boolean))]
  const others = names.filter(n => n !== txt(lo.recommendedLender))
  if (others.length) assessment.push(`${txt(lo.recommendedLender)} was recommended after comparing them against ${andList(others)}.`)
  else {
    assessment.push(shout(`ONLY ONE LENDER RECORDED — the recommendation has not been compared against any alternative.`))
    gaps.push({ what: 'Only one lender option recorded', where: 'Lending options → lender options' })
  }

  const ret = retirementStrategy(deal, v)
  assessment.push(...ret.parts)
  gaps.push(...ret.gaps)

  const agreed = txt(cd.clientAgreedLender) || txt(lo.clientAgreedLender)
  if (agreed === 'Yes') assessment.push('The clients agreed with the recommendation and proceeded with it.')
  else if (agreed === 'No') {
    const chosen = txt(cd.clientChosenLender) === '__other__' ? txt(cd.clientChosenLenderOther) : txt(cd.clientChosenLender)
    const why = txt(cd.clientChosenLenderReason)
    assessment.push(`The clients did not proceed with the original recommendation and chose ${chosen || 'another lender'}${why ? `, for the following stated reason: "${why}"` : ''}.`)
  } else {
    assessment.push(shout(`NOT RECORDED — the clients' agreement to the recommendation has not been captured.`))
    gaps.push({ what: "The clients' agreement to the recommendation", where: 'Lending options → client agreement' })
  }

  // ALWAYS, BOTH OF THEM. Fabio, 10 Sep 2026.
  assessment.push([
    `The recommendation is considered to be in the clients' best interests, having regard to their circumstances, their stated requirements and the options researched. There are no known conflicts of interest in relation to this transaction.`,
    `Having regard to the clients' circumstances, what they said they wanted and the options researched, the recommendation is considered to be in their best interests. There are no known conflicts of interest in relation to this transaction.`,
    `On the clients' circumstances, their stated requirements and the lenders researched, this recommendation is considered to be in their best interests. No conflicts of interest are known in relation to this transaction.`,
  ][v - 1])

  return {
    text: `ANALYSIS\n\n${analysis.join(' ')}\n\nASSESSMENT\n\n${assessment.join(' ')}`,
    gaps, variant: v,
  }
}

// The Product requirements panel, in words rather than keys.
const PRODUCT_WORDS: Record<string, string> = {
  redraw: 'a redraw facility',
  offsetAccount: 'an offset account',
  variableRate: 'a variable rate',
  fixedRate: 'a fixed rate',
  fixedAndVariable: 'a split of fixed and variable',
  principalAndInterest: 'principal and interest repayments',
  interestOnly: 'interest only repayments',
  interestInAdvance: 'interest in advance',
  lineOfCredit: 'a line of credit',
  lowestCost: 'the lowest cost',
  lenderPolicy: 'lender policy',
  approvedQuickly: 'a quick approval',
  specificFeatures: 'specific features',
}
