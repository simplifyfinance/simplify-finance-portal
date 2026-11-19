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
import { assetBreakdown } from './box-power'
import { article } from './article'
import { useOf } from './deal-labels'
import { loanAmount, lvrOf, fundsToComplete } from './funds-to-complete'
import { drawnLoan } from './lmi'
import { splitsOf, dealRow } from './deal-structure'
import { fullName, notWorking, selfEmployed, monthsBetween } from './fact-find'
import { annualIncomeOfApplicant } from './income-calculations'
import { applicantsOf } from './applicants'
import { variantOf, andList, structureOf, flexibilityPassage, type Gap } from './box-one'
import { lendingBySplit } from './lending-by-split'
import { securitiesOf } from './box-security'
import { retirementPicture } from './box-goals'
import { roleBefore, currentRole, currentRoles, when } from './employment-in-order'
import { ownersOf, ownsOpener, plainAddress } from './who-owns-what'
import { whyOneLenderSentence } from './only-one-lender'
import { shapeOf } from './box-deposit'
import { CREDIT_QUESTIONS } from './credit-history-facts'
import { clientAgreement, optionOnTheDeal, optionGap, lenderOnTheDeal } from './client-agreement'
import { OFFICE } from './same-date-everywhere'

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
// One copy, in lib/article.ts - it was written out four times and was wrong
// in all four. See the note there.

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

/** A rate with exactly one per cent sign, however it was typed. */
function pct(v: any): string {
  return `${String(v ?? '').trim().replace(/%+$/, '')}%`
}

// ---------------------------------------------------------------------------
// THE RETIREMENT STRATEGY — on every file, whatever the ages
// ---------------------------------------------------------------------------

/** What the note says when nobody's loan runs past their retirement. */
export const FINISHES_FIRST =
  'No exit strategy will be required as the loan will be completed prior to retirement.'

export function retirementStrategy(deal: any, v: 1 | 2 | 3): { parts: string[]; gaps: Gap[] } {
  const { term, people } = retirementPicture(deal)
  const parts: string[] = []
  const gaps: Gap[] = []
  const missing: string[] = []

  // ---------------------------------------------------------------------
  // WHEN THE LOAN FINISHES FIRST, THAT IS ONE SENTENCE
  // ---------------------------------------------------------------------
  //
  // 17 Nov 2026. This wrote a paragraph per applicant - the age they gave, how
  // they intend to repay, and the arithmetic showing the term lands inside it -
  // on a file where the answer was simply that the loan ends before anybody
  // retires. Fabio's broker replaced the lot with one line, and credit's word
  // for the notes was "repetitive".
  //
  // The ages and the arithmetic come back the moment they matter, which is when
  // somebody's term runs PAST their retirement age. That is the case that needs
  // an evidenced exit strategy and it is still spelled out in full below.
  //
  // A MISSING RETIREMENT AGE IS STILL CHASED. Fabio, asked straight: "You
  // always need to put a retirement age. It's on the compliance... just put a
  // warning on top saying you don't have a retirement age." It is a warning on
  // the list above the note, it does not stop anybody working, and it goes to
  // the team as an instruction.
  const recorded = people.filter(p => p.retiresAt !== null)
  const quiet = recorded.length > 0 && !people.some(p => p.outlives)
  if (quiet) {
    // IT SAYS WHAT THEY WILL DO, NOT THAT NOTHING IS NEEDED - 19 Nov 2026.
    //
    // This printed "No exit strategy will be required as the loan will be
    // completed prior to retirement." Katie crossed it out on both files she
    // corrected and wrote what the file actually records: "Upon retirement,
    // clients will downsize their property."
    //
    // She is right, and the fact was already on the deal - the repayment method
    // is answered under Compliance, Risks, Exit strategy, and this branch was
    // the one place that read it and then said nothing.
    //
    // GROUPED, because two applicants who gave the same answer is one sentence.
    const byMethod = new Map<string, string[]>()
    for (const p of recorded) {
      const how = REPAYMENT_METHOD_WORDS[p.method] || ''
      if (!how) continue
      byMethod.set(how, [...(byMethod.get(how) || []), p.who])
    }
    for (const [how, who] of byMethod) parts.push(`${andList(who)} ${how}.`)
    for (const p of recorded) {
      if (!(REPAYMENT_METHOD_WORDS[p.method] || '')) {
        gaps.push({ what: `Repayment method for ${p.who}`, where: 'Compliance → Risks → Exit strategy' })
      }
    }
    for (const p of people) if (p.retiresAt === null) missing.push(p.who)
    if (missing.length) {
      parts.push(shout(`NOT RECORDED — no retirement age has been recorded for ${andList(missing)}, so the loan cannot be measured against retirement.`))
      gaps.push({ what: `Retirement age for ${andList(missing)}`, where: 'Compliance → Risks → Exit strategy' })
    }
    return { parts, gaps }
  }

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
export const CLEAN_ORDER = ['declaredBankrupt', 'unsatisfiedJudgements', 'problemsMeetingCommitments',
                     'simultaneousApplications', 'officerInLiquidation']
export const CLEAN_WORDS: Record<string, string> = {
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

/** The five answers for one person, sorted into the three things they can be. */
type Declared = { first: string; raised: string[]; clean: string[]; blank: string[] }

/** "have never been declared bankrupt, have no unsatisfied judgements and ..." */
function cleanWords(keys: string[]): string {
  return CLEAN_ORDER.filter(k => keys.includes(k)).map(k => CLEAN_WORDS[k])
    .map(x => x.replace(/^has /, 'have '))
    .join(', ').replace(/, ([^,]*)$/, ' and $1')
}

export function creditHistorySentences(deal: any): { parts: string[]; gaps: Gap[] } {
  const risks = deal?.compliance_data?.risks || {}
  const parts: string[] = []
  const gaps: Gap[] = []
  const noRow: string[] = []
  const all: Declared[] = []

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
    all.push({ first, raised, clean, blank })
  }

  // AN ADVERSE ANSWER LEADS, and it is always said about one named person.
  for (const d of all) {
    if (!d.raised.length) continue
    parts.push(`${d.first} ${andList(d.raised)}. This must be addressed with the lender.`)
    gaps.push({ what: `${d.first} has disclosed an adverse credit answer`, where: 'Compliance → Risks → Credit history' })
  }

  // ---------------------------------------------------------------------
  // THE CLEAN DECLARATION, SAID ONCE
  // ---------------------------------------------------------------------
  //
  // 17 Nov 2026. On a clean joint file this wrote the same five things twice,
  // once per applicant, identical apart from the name - about eighty words of
  // a compliance note saying nothing the sentence above it had not. Fabio's
  // broker merged them by hand; credit's word for the notes was "repetitive".
  //
  // IT ONLY MERGES PEOPLE WHOSE ANSWERS ARE THE SAME. Anybody with an adverse
  // answer or an unanswered question keeps their own sentence, so a sentence
  // with one name on it is itself the signal that this person is different.
  const together = new Map<string, Declared[]>()
  for (const d of all) {
    if (!d.clean.length || d.raised.length || d.blank.length) continue
    const key = CLEAN_ORDER.filter(k => d.clean.includes(k)).join('|')
    together.set(key, [...(together.get(key) || []), d])
  }
  for (const [key, who] of together) {
    const names = andList(who.map(d => d.first))
    parts.push(`${names} ${who.length > 1 ? 'have' : 'has'} confirmed that they ${cleanWords(key.split('|'))}.`)
  }

  // And anybody the merge left out still says what they did answer.
  for (const d of all) {
    if (!d.clean.length || (!d.raised.length && !d.blank.length)) continue
    parts.push(`${d.first} has confirmed that they ${cleanWords(d.clean)}.`)
  }

  for (const d of all) {
    if (!d.blank.length) continue
    parts.push(shout(`NOT RECORDED — ${andList(d.blank)} not answered for ${d.first}.`))
    gaps.push({ what: `Credit history not complete for ${d.first}`, where: 'Compliance → Risks → Credit history' })
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

  // THE LOAN THEY ACTUALLY SIGN FOR, NOT THE BASE.
  //
  // 27 Oct 2026. loanAmount() is the sum of the BC splits. Where LMI is
  // capitalised the premium is borrowed too, so this paragraph was telling
  // a client - in the compliance file - that they were borrowing $886,000
  // when the contract was for $912,000.
  //
  // Fabio's own rule, 24 Sep 2026, written into lib/build-card.ts at the
  // time: "when the premium is capitalised there is ONE loan line and it is
  // the one they borrow." It was applied to one email and nowhere else.
  //
  // The LVR below is deliberately NOT changed - an LVR is worked out
  // against the base and the portal has always drawn it that way.
  const amount = drawnLoan(deal, loanAmount(deal))
  const term = splitsOf(deal).map(s => txt(s.termYears)).find(Boolean) || txt(bc.loanTerm)
  const lvr = lvrOf(deal)
  const purchase = readMoney(bc.purchasePrice)
  const deposit = readMoney(bc.deposit)
  const isPurchase = /purchase|fhb|construction|bridging|buy/.test(txt(bc.template))

  let open = `${whoFull} ${plural ? 'are' : 'is'} borrowing ${amount > 0 ? money(amount) : shout('NOT RECORDED — no loan amount has been recorded')}`
  if (term) open += ` over a ${termInWords(term)} year term`
  // THE SECURITIES, BY NAME.
  //
  // 12 Oct 2026. On a three-property refinance this said the clients were
  // borrowing "against the security recorded on this deal" - a placeholder,
  // because compliance_data.securityAddress is one box and there were three
  // houses. Box nine then named all three immediately underneath it.
  //
  // securitiesOf() is the same list box nine uses and in the same order, so the
  // two cannot name different properties. The old line stays as the fallback
  // for a deal with nothing recorded at all.
  const named = securitiesOf(deal).map(x => plainAddress(x.address)).filter(Boolean)
  // EVERY PURCHASE WAS AN OWNER-OCCUPIED PROPERTY - 19 Nov 2026.
  //
  // Those five words were typed into this line and never read anything. On the
  // Makeham file it described vacant land bought for investment as an
  // owner-occupied property, in the compliance note, under a product called
  // Vacant Land Prime Alt Doc. Katie's correction: "to purchase vacant land in
  // Oura for investment purposes".
  //
  // Both facts were already on the deal. useOf() answers owner-occupied,
  // investment or SMSF off deals.property_use and falls back to the template -
  // the same answer the chip on the card has worn for weeks. The property type
  // is bc.propertyType, the dropdown the valuation order reads.
  //
  // NOTHING IS GUESSED. A deal with no property type recorded says "property",
  // which is what this line has always said, and a use nobody has answered adds
  // no clause at all.
  const use = useOf(deal)
  const kind = txt(bc.propertyType).toLowerCase()
  const what = /land/.test(kind) ? 'vacant land' : (kind || 'property')
  // Land is uncountable - "a vacant land" is not English.
  const lead = what === 'vacant land' ? what
    : `${use === 'owner_occupied' ? 'an owner-occupied' : article(what)} ${what}`
  open += isPurchase
    ? ` to purchase ${lead}${txt(bc.suburb) ? ` in ${txt(bc.suburb)}` : ''}`
      + `${use === 'investment' ? ' for investment purposes'
         : use === 'smsf' ? ' within the self managed super fund' : ''}`
    : ` against ${named.length > 0 ? andList(named) : (txt(row.securityAddress) || 'the security recorded on this deal')}`
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
    // IN DATE ORDER, NOT IN TYPING ORDER. 17 Nov 2026 - see
    // lib/employment-in-order.ts. This used to take whichever row had been
    // filled in first and call it their job.
    const jobs = currentRoles(a)
    const idle = jobs.length > 0 && jobs.every((e: any) => notWorking(e))
    const job = currentRole(a)
    if (idle || !job) {
      const occ = txt(jobs[0]?.occupation)
      people.push(`${first} is not working${occ ? `, with an occupation recorded as ${occ.toLowerCase()}` : ''}`)
      continue
    }
    const occ = txt(job.occupation).toLowerCase()
    const months = monthsBetween(job.startDate, job.endDate)
    const inc = annualIncomeOfApplicant(a)
    // "DALE IS SELF-EMPLOYED SELF-EMPLOYED AS A CARPENTER" - 19 Nov 2026.
    //
    // The type and the basis are two different dropdowns, and on a self-employed
    // applicant the basis IS "Self-Employed", so the word came out twice. Katie,
    // correcting the note by hand: "Dale is a self-employed carpenter."
    //
    // So a basis that repeats the word we have just printed is dropped, and a
    // self-employed applicant with an occupation reads as one phrase rather than
    // as a state plus a job.
    const se = selfEmployed(job)
    const word = se ? 'self-employed' : 'employed'
    const basis = txt(job.employmentBasis).toLowerCase()
    const extra = basis && !basis.includes(word) ? ` ${basis}` : ''
    const bits = se && occ
      ? [`${first} is ${article(`${word} ${occ}`)} ${word} ${occ}`]
      : [`${first} is ${word}${extra}`]
    if (!se && occ) bits.push(`as ${article(occ)} ${occ}`)
    if (months > 0) bits.push(`and has held the role for ${months} month${months === 1 ? '' : 's'}`)
    let line = bits.join(' ')
    if (inc > 0) line += `, on a gross salary of ${money(inc)} a year`
    // THE ROLE BEFORE THIS ONE, AND IT MEANS THE MOST RECENT ONE.
    //
    // 17 Nov 2026. This was `.find(e => !e.isCurrent && e.endDate)`, which
    // takes the first row in the list - and the list is in the order somebody
    // typed it. On a file with two previous roles the note named the older
    // one. Fabio: "the portal is not adjusting cjronoloigcally so AI notes
    // confused the previous employment supposed to be 2026".
    const prev = roleBefore(a)
    const prevEnd = prev ? when(prev.endDate) : null
    // A date that cannot be read prints nothing rather than "Invalid Date".
    if (prevEnd !== null) {
      line += `, with a previous role ending in ${new Date(prevEnd).toLocaleDateString('en-AU', { timeZone: 'UTC', month: 'long', year: 'numeric' })}`
    }
    people.push(line)
  }
  if (people.length) analysis.push(people.join('. ').replace(/^(.)/, c => c.toUpperCase()) + '.')

  const deps = txt(ff.dependants) || txt(bc.dependants)
  if (deps && deps !== '0') {
    // THEIR AGES ARE NOT THE NOTE'S BUSINESS - 19 Nov 2026. Katie cut ", whose
    // ages are not recorded" off both files she corrected. A compliance note
    // reporting the absence of something nobody asked for is noise, and Fabio:
    // "everything that is repetitive to be excluded."
    analysis.push(`They have ${countInWords(deps)} dependant${deps === '1' ? '' : 's'}.`)
  }

  // --- what they own ---
  //
  // WHOSE HOUSE IT IS, AND NOT THE SAME OPENER THREE TIMES RUNNING.
  //
  // 17 Nov 2026. Every property sentence began "They own", on a file where one
  // applicant owned all three on his own. The fact find records an ownership
  // percentage per applicant per property and nothing here was reading it. See
  // lib/who-owns-what.ts - and note that the pronoun comes off the recorded
  // gender or is not used at all.
  let lastOwners: string[] | null = null
  for (const p of (ff.properties || [])) {
    const addr = plainAddress(p?.address)
    if (!addr) continue
    const val = readMoney(p?.value)
    const owing = (p?.loans || []).reduce((t: number, l: any) => t + (readMoney(l?.balance) ?? 0), 0)
    const lender = (p?.loans || []).map((l: any) => txt(l?.lenderName)).filter(Boolean)[0]
    const rate = (p?.loans || []).map((l: any) => txt(l?.interestRate)).filter(Boolean)[0]
    const sub = txt(p?.propertySubtype).toLowerCase()
    const selling = /sold|sell/i.test(txt(p?.futureUse))
    const owners = ownersOf(p, ff.applicants || [])
    let line = `${ownsOpener(owners, ff.applicants || [], lastOwners)} ${addr}${sub ? `, ${article(sub)} ${sub}` : ''}`
    lastOwners = owners
    if (selling) line += ', which the fact find records as being sold'
    if (val) line += `. It is valued at ${money(val)}`
    // "ON A RATE OF 6.69%%" - 19 Nov 2026. The box on the fact find takes
    // whatever somebody types, and plenty of people type the sign. pct() puts
    // exactly one on.
    if (owing > 0) line += `, with ${money(owing)} owing${lender ? ` to ${lender}` : ''}${rate ? ` on a rate of ${pct(rate)}` : ''}`
    analysis.push(line + '.')
  }

  // $120,000 THAT WAS IN THE TOTAL AND IN NONE OF THE WORDS - 19 Nov 2026.
  //
  // This totalled EVERY asset and then itemised three kinds. On the Makeham
  // file that read "Recorded assets total $336,738.82 — $38,627.21 in bank
  // accounts and $178,111.61 in superannuation", which is $216,738. The missing
  // $120,000 was home contents and vehicles: counted, never named.
  //
  // Nobody caught it. It went through a broker and through credit, and a
  // compliance note whose own arithmetic does not add up is the kind of thing
  // that is noticed by exactly the wrong person.
  //
  // assetLine() in lib/box-power.ts has grouped them properly all along - every
  // kind, the words for a sum of them, biggest first. The breakdown comes from
  // there now, so the two boxes cannot disagree about what somebody owns.
  const owned = assetBreakdown(deal)
  if (owned.total > 0) {
    analysis.push(`Recorded assets total ${money(owned.total)}`
      + `${owned.named.length ? ` — ${andList(owned.named)}` : ''}.`)
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
  //
  // WHERE THE RATE COMES FROM, AND WHOSE IT IS.
  //
  // 15 Sep 2026. This read the recommended lender's "Variable P&I" box at the
  // top of the lender card and nothing else, so a deal whose rates are typed
  // into the SPLITS - which is how the team records them - wrote this sentence
  // with no rate in it at all.
  //
  // And where that box was empty it fell back to lo.lenders[0].variablePI.rate,
  // which is OPTION ONE'S RATE UNDER THE RECOMMENDED LENDER'S NAME. That is a
  // wrong number rather than a missing one. deal-structure.ts already refuses
  // to do it and says why. It is gone.
  //
  // splitsOf() already merges the recommended lender's own splits, so it is the
  // one place to ask. The boxes at the top are still read for a lender recorded
  // the older way.
  const rateClause = (() => {
    const priced = splitsOf(deal).filter(x => txt(x.rate))
    let found: { rate: string; fixed: boolean }[] = priced.map(x => ({
      rate: txt(x.rate),
      fixed: /fixed/i.test(txt(x.repaymentType)),
    }))
    if (found.length === 0) {
      const rec = optionOnTheDeal(lo)
      found = ([['variablePI', false], ['variableIO', false], ['fixedPI', true], ['fixedIO', true]] as [string, boolean][])
        .filter(([k]) => rec?.[k]?.enabled && txt(rec[k]?.rate))
        .map(([k, fixed]) => ({ rate: txt(rec![k].rate), fixed }))
    }
    const rates = [...new Set(found.map(f => f.rate))]
    if (rates.length === 0) return ''
    if (rates.length > 1) return `, on rates of ${andList(rates.map(r => `${r}%`))}`
    // One rate, and a word for it only where every split agrees on the answer.
    if (found.every(f => f.fixed)) return `, on a fixed rate of ${rates[0]}%`
    if (found.every(f => !f.fixed)) return `, on a variable rate of ${rates[0]}%`
    return `, on a rate of ${pct(rates[0])}`
  })()
  const repay = splitsOf(deal).map(x => txt(x.repaymentType)).find(Boolean)
  // THE SPLITS, ONE AT A TIME, UNDER THE HOUSE EACH IS SECURED BY.
  //
  // 12 Oct 2026. The sentence below used to end "with principal and interest
  // repayments" on a deal where half the money was interest only, because it
  // read the FIRST split's type and called it the deal's. Two sentences later
  // the flexibility passage said interest only. See lib/lending-by-split.ts for
  // the whole fault.
  //
  // So on a deal with more than one split, or more than one security, the
  // summary stops claiming a repayment type and the splits say it themselves.
  // A single-split deal is unchanged - there is nothing to flatten.
  const perSplit = lendingBySplit(deal)

  if (s.lender && s.product) {
    let line = `${s.lender}'s ${s.product} has been recommended`
    line += rateClause
    if (repay && !perSplit.worthSaying) {
      line += ` with ${repay.toLowerCase().includes('io') || /interest only/i.test(repay) ? 'interest only' : 'principal and interest'} repayments`
    }
    if (term) line += ` over a ${termInWords(term)} year term`
    assessment.push(line + '.')
  }

  if (perSplit.worthSaying) {
    const spread = perSplit.mixed
      ? ' The lending is not on one repayment type \u2014 each split is set to suit the money in it.' : ''
    // Said once above the list rather than under every line - see sharedPurpose.
    const shared = perSplit.sharedPurpose ? ` All of it is ${perSplit.sharedPurpose}.` : ''
    if (perSplit.securityCount > 1) {
      assessment.push(`This is a refinance of existing lending secured by ${COUNT[perSplit.securityCount] || String(perSplit.securityCount)} properties. ` +
        'The existing split structure has been kept, because each split reflects what those funds were ' +
        'originally used for.' + shared + spread)
    } else if (perSplit.mixed || shared) {
      assessment.push((shared + spread).trim())
    }

    for (const g of perSplit.groups) {
      if (g.security) assessment.push(`Secured by ${plainAddress(g.security.address) || 'a property whose address is not recorded'}:`)
      else if (perSplit.securityCount > 1) assessment.push('Not recorded against any of the securities above:')
      for (const l of g.lines) assessment.push(l.text)
    }

    // NOT RECORDED, RATHER THAN A PLAUSIBLE SENTENCE. The only reason anybody
    // writes down is the "Original purpose of funds" box and the split's
    // purpose; a split with neither is a gap on the form, not a gap in the
    // wording to be filled in here.
    //
    // AND A DOLLAR-FOR-DOLLAR REFINANCE IS NOT ASKED. 17 Nov 2026, Fabio: "the
    // purpose recorded for the splits, we don't really care because it's a
    // refinance." He is right, and the paragraph a few lines above already
    // says why - on a refinance the existing split structure is kept BECAUSE
    // each split reflects what those funds were originally used for. Nothing
    // new is being advanced, so there is no new purpose to record, and the
    // portal was asking a question it had already answered itself.
    const blind = shapeOf(deal) === 'refinance' ? [] : perSplit.lines.filter(l => l.unexplained)
    if (blind.length > 0) {
      assessment.push(shout(`NOT RECORDED \u2014 nothing has been recorded to explain ` +
        `${blind.length === 1 ? 'the' : 'the following'} split${blind.length === 1 ? '' : 's'}: ` +
        `${andList(blind.map(l => l.split.label || 'unnamed split'))}. ` +
        `Record the purpose of the funds on the borrowing capacity.`))
      gaps.push({ what: 'Purpose of funds on each split', where: 'Borrowing capacity' })
    }
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

  // WHICH MONEY THE NEXT PARAGRAPH IS ABOUT.
  //
  // 12 Oct 2026. flexibilityPassage() describes the loan's shape, and on a deal
  // where only SOME splits are interest only it opens "Interest only repayments
  // for the first 5 years keep the commitment as low as possible" - which reads
  // as the whole loan. Half the money was principal and interest.
  //
  // THE PARAGRAPH ITSELF IS NOT TOUCHED. Those three wordings were read aloud
  // before they went in and they are Fabio's; one sentence goes in front of
  // them instead, and only on a deal whose splits disagree. A deal that is
  // entirely interest only, or entirely principal and interest, prints exactly
  // what it printed yesterday.
  const flex = flexibilityPassage(s, who, v)
  if (flex) {
    if (perSplit.mixed && s.interestOnly) {
      assessment.push('Where splits are on interest only, the reasoning is as follows.')
    }
    assessment.push(flex)
  }

  // the fees, from the lender's own record
  // THE FEES AND THE TURNAROUND BELONG TO THE LENDER THIS DEAL IS WITH.
  //
  // 29 Sep 2026. This read the RECOMMENDED option, so on a deal where the
  // clients went elsewhere the line below would have printed "ubank's stated
  // turnaround is 5 days" using Macquarie's five days - a real figure, a real
  // bank, and no relation between them. It says nothing at all now rather than
  // something wrong. See lib/client-agreement.ts.
  const rec = optionOnTheDeal(lo) || {}
  const fees: string[] = []
  // "A VALUATION FEE OF $AT COST" - 19 Nov 2026.
  //
  // A fee is not always a number. MA Money's valuation is charged at cost, and
  // the library holds the words "At cost" - which this printed a dollar sign in
  // front of. Katie's correction: "a valuation fee at cost".
  //
  // So a figure gets "of $x" and anything else gets said as it stands.
  const fee = (label: string, val: any) => {
    const t = txt(val)
    if (!t) return
    if (/^\$/.test(t)) { fees.push(`${label} of ${t.replace(/\/yr$/, '')}`); return }
    if (/^[0-9]/.test(t)) { fees.push(`${label} of $${t.replace(/\/yr$/, '')}`); return }
    fees.push(`${label} ${t.toLowerCase()}`)
  }
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

  // THE LENDER THIS FILE RECOMMENDS IS THE ONE IT IS PROCEEDING WITH.
  //
  // Fabio, 29 Sep 2026: "Always change sentec to say we reocmmended whne client
  // changes their mind". The client signs this. A sentence telling them we
  // recommended a bank they are not borrowing from contradicts every other line
  // on the page - and the history is not lost, it is two sentences below, where
  // it names the original recommendation and quotes their reason for leaving it.
  //
  // The same change is made in lib/box-one.ts, which writes this sentence for
  // box one. Both read lenderOnTheDeal.
  const names: string[] = [...new Set<string>((lo.lenders || []).map((l: any) => txt(l?.lenderName)).filter(Boolean))]
  const onTheDeal = lenderOnTheDeal(lo)
  const others = names.filter(n => n !== onTheDeal)
  if (others.length) assessment.push(`${onTheDeal} was recommended after comparing them against ${andList(others)}.`)
  else {
    // ONE LENDER, AND THE REASON CREDIT RECORDED FOR IT.
    //
    // 17 Nov 2026. This shouted at a broker from inside a document that goes to
    // a lender, and the broker deleted it and typed the reason by hand every
    // time. The reason is now asked for on Lending options before the option
    // can be issued, so by the time this box is written it exists. See
    // lib/only-one-lender.ts.
    const why = whyOneLenderSentence(lo, onTheDeal)
    if (why) assessment.push(why)
    else {
      assessment.push(shout(`ONLY ONE LENDER RECORDED — the recommendation has not been compared against any alternative.`))
      gaps.push({ what: 'Only one lender option recorded', where: 'Lending options → lender options' })
    }
  }

  const ret = retirementStrategy(deal, v)
  assessment.push(...ret.parts)
  gaps.push(...ret.gaps)

  // The lending options tab, and only it. This used to read the compliance
  // tab's copy first, and on Charles Mullins 2026 that copy was months out of
  // date - it printed "the clients chose AMP" onto a Bankwest deal, on a
  // regulated document, with nobody having chosen AMP. See lib/client-agreement.ts.
  const optGap = optionGap(lo)
  if (optGap) {
    assessment.push(shout(`NO LENDING OPTION FOR THE CHOSEN LENDER — the rate, the product and the fees on this file are not recorded against the lender the clients chose.`))
    gaps.push({ what: optGap, where: 'Lending options → lender options' })
  }

  const agreement = clientAgreement(lo)
  const agreed = agreement.agreed
  // SAID ONCE, IN THE BOX THE DECISION BELONGS TO.
  //
  // 17 Nov 2026. "The clients agreed with the recommendation and proceeded with
  // it." was printed word for word at the end of this box AND at the end of
  // Options presented & recommended. It stays there, because that box is about
  // the recommendation and what was decided about it. Credit's word for the
  // notes was "repetitive", and this was the plainest example in them: the same
  // sentence, twice, on one page.
  //
  // A DISAGREEMENT IS NOT A DUPLICATE. Where the clients went elsewhere this
  // box still says so and names the lender, because the paragraph above it
  // reads as though the recommendation stood.
  if (agreed === 'No') {
    const chosen = agreement.chosen
    const why = agreement.reason
    // NAMED, so the two sentences do not read as contradicting each other.
    // Above, this file says the deal's lender was recommended; here it says
    // which lender that replaced and why. Without the name, a reader is left to
    // work out what "the original recommendation" was from a list.
    const original = txt(lo.recommendedLender)
    assessment.push(
      `The clients did not proceed with the original recommendation${original ? ` of ${original}` : ''} ` +
      `and chose ${chosen || 'another lender'}${why ? `, for the following stated reason: "${why}"` : ''}.`)
  } else if (agreed !== 'Yes') {
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
