// BOX ONE — PRIMARY REASONS FOR SEEKING CREDIT. COMPOSED, NOT GENERATED.
//
// There is no model in this file. Every sentence is assembled from a field
// somebody typed, so it cannot invent a purpose, a feature or a figure, and the
// same deal reads the same way every time it is written.
//
// Fabio, 9 Sep 2026, on the compliance tab: "we were giving factual information,
// and we were gonna go one by one". And on the wording: "it needs to flow. It
// really needs to be obvious that it's not an AI typing this."
//
// THE FOUR RULES THIS FILE OBEYS, ALL OF THEM HIS:
//
// 1. THE PRODUCT DECIDES, NOT THE QUESTIONNAIRE. What is said about rate type,
//    repayments, offset and redraw comes from the loan that was actually
//    recommended. The Product requirements panel is not consulted. Fabio,
//    9 Sep: "focus on the product, not on the questions because even if they say
//    not important... but the product has an offset account, we just keep those
//    sentence."
//
// 2. REDRAW COMES WITH A VARIABLE RATE. It is not recorded per product anywhere
//    and does not need to be. Fabio: "Redraw is always available in any variable
//    loan. So just mention redraw when we have a variable loan."
//
// 3. A GAP IS SHOUTED, NOT SMOOTHED OVER. A missing purpose or a missing sale
//    figure is written into the text in capitals between asterisks, because
//    colour does not survive being pasted into Salestrekker and this has to stay
//    obvious wherever the paragraph ends up.
//
// 4. THE WORDING VARIES ACROSS THE BOOK, NEVER WITHIN A DEAL. Three ways of
//    saying each thing, chosen from the deal's own id - so an auditor reading
//    twenty files does not see one paragraph twenty times, and regenerating one
//    file never rewords it underneath the team. Fabio, 10 Sep: "take a variation
//    for the deal itself... we don't vary or deviate to that."

import { money, readMoney } from './money'
import { fundsToComplete, loanAmount, lvrOf } from './funds-to-complete'
import { splitsOf, dealRow } from './deal-structure'
import { fullName, currentEmployment, notWorking, selfEmployed } from './fact-find'
import { annualIncomeOfApplicant } from './income-calculations'
import { applicantsOf } from './applicants'

const txt = (v: any) => String(v ?? '').trim()

// A gap the team has to close, named so the screen can list it separately from
// the paragraph.
export type Gap = { what: string; where: string }

export type BoxOne = {
  text: string
  gaps: Gap[]
  // Which of the three wordings this deal drew. Recorded so a change of variant
  // is visible rather than mysterious.
  variant: 1 | 2 | 3
}

// SHOUTED, SO IT SURVIVES A COPY AND PASTE.
const shout = (s: string) => `** ${s} **`

// THE VARIANT IS THE DEAL'S, NOT THE MOMENT'S.
//
// Seeded from the deal id, so it never moves. Two deals side by side read
// differently; one deal regenerated ten times reads the same ten times.
export function variantOf(dealId: any): 1 | 2 | 3 {
  const s = txt(dealId)
  if (!s) return 1
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return ((h % 3) + 1) as 1 | 2 | 3
}

// Natural English for a list of names or lenders: "A", "A and B", "A, B and C".
export function andList(items: string[]): string {
  const xs = items.filter(Boolean)
  if (xs.length === 0) return ''
  if (xs.length === 1) return xs[0]
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

// Loan terms read better as words in prose than as a numeral.
const TERM_WORDS: Record<string, string> = {
  '10': 'ten', '15': 'fifteen', '20': 'twenty', '25': 'twenty-five',
  '30': 'thirty', '35': 'thirty-five', '40': 'forty',
}
const termInWords = (t: string) => TERM_WORDS[txt(t)] || txt(t)

// Small counts read as words in prose. "They have 2 dependants" is a form
// speaking; "they have two dependants" is a person.
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const countInWords = (n: string) => COUNT_WORDS[Number(txt(n))] ?? txt(n)

// "investment manager" needs its article; "director of nursing" needs it too.
const article = (word: string) => /^[aeiou]/i.test(txt(word)) ? 'an' : 'a'

// ---------------------------------------------------------------------------
// WHAT THE RECOMMENDED LOAN ACTUALLY IS
// ---------------------------------------------------------------------------

export type Structure = {
  variable: boolean
  fixed: boolean
  interestOnly: boolean
  principalAndInterest: boolean
  offset: boolean
  // True only when the product records a nil annual fee. The no-offset wording
  // claims a fee saving, and a claim like that has to trace to a field.
  noAnnualFee: boolean
  ioYears: string
  fixedYears: string
  lender: string
  product: string
}

const on = (mod: any) => !!mod?.enabled

export function structureOf(deal: any): Structure {
  const lo = deal?.lo_data || {}
  const rec = (lo.lenders || []).find((l: any) => txt(l?.lenderName) === txt(lo.recommendedLender))
           || (lo.lenders || [])[0] || {}
  const variable = on(rec.variablePI) || on(rec.variableIO)
  const fixed = on(rec.fixedPI) || on(rec.fixedIO)
  const io = on(rec.variableIO) || on(rec.fixedIO)
  const pi = on(rec.variablePI) || on(rec.fixedPI)

  // The splits are the second opinion on repayment type - a lender module says
  // what was priced, a split says what was structured.
  const splitTypes = splitsOf(deal).map(s => txt(s.repaymentType).toUpperCase())
  const splitIO = splitTypes.some(t => t.startsWith('IO') || t.includes('INTEREST ONLY'))
  const splitPI = splitTypes.some(t => t.includes('P&I') || t.includes('PRINCIPAL'))

  const fee = txt(rec.annualFee).replace(/[$,\s]/g, '').toLowerCase()

  return {
    variable, fixed,
    interestOnly: io || splitIO,
    principalAndInterest: pi || splitPI,
    offset: txt(rec.offsetAccount).toLowerCase() === 'yes',
    // "$0", "0", "nil", "none" - and an unrecorded fee is NOT a nil fee.
    noAnnualFee: fee === '0' || fee === '0/yr' || fee === 'nil' || fee === 'none',
    ioYears: txt(rec.variableIO?.ioYears || rec.fixedIO?.ioYears),
    fixedYears: txt(rec.fixedPI?.fixedYears || rec.fixedIO?.fixedYears),
    lender: txt(rec.lenderName),
    product: txt(rec.productName),
  }
}

// ---------------------------------------------------------------------------
// THE FLEXIBILITY PASSAGE — three wordings for each shape the loan can take
// ---------------------------------------------------------------------------

// Every one of these was read out loud before it went in. They are deliberately
// different lengths and different shapes; three sentences of identical
// construction is what makes a paragraph read like a form.
export function flexibilityPassage(s: Structure, who: string, v: 1 | 2 | 3): string {
  const pi = s.principalAndInterest && !s.interestOnly
  const fixedYrs = s.fixedYears ? `${s.fixedYears} years` : 'the fixed period'
  const ioYrs = s.ioYears ? `${s.ioYears} years` : 'the interest only period'

  // Fixed and variable together.
  if (s.fixed && s.variable) {
    return [
      `Splitting the loan between a fixed and a variable portion gives ${who} the best of both — certainty over the repayment on the fixed part for ${fixedYrs}, and the freedom on the variable part to make extra repayments whenever they can, redraw them if they need to, and pay that portion down early without a break cost.${pi ? ' Both portions are principal and interest, so the balance is reducing across the whole loan.' : ''}${s.offset ? ' The offset account attaches to the variable side, where savings held against the loan do the most good.' : ''}`,
      `The loan is split across a fixed and a variable portion. Fixing part of it holds that repayment steady for ${fixedYrs}, while the variable portion stays open — extra repayments whenever ${who} can manage them, redraw on anything paid ahead, and no penalty for clearing it early.${pi ? ' Principal and interest repayments apply across both, so the balance reduces throughout.' : ''}${s.offset ? ' The offset sits on the variable side and cuts the interest charged on money that stays theirs to draw on.' : ''}`,
      `Part of this loan is fixed and part of it is variable, which lets ${who} hold a known repayment on one portion for ${fixedYrs} while keeping the other free to move — they can pay ahead on it, take that money back through redraw, or clear it altogether without a break cost.${pi ? ' Both parts reduce the balance from the outset on principal and interest repayments.' : ''}${s.offset ? ' The offset account works against the variable portion.' : ''}`,
    ][v - 1]
  }

  // Fixed only.
  if (s.fixed && !s.variable) {
    return [
      `Fixing the rate for ${fixedYrs} gives ${who} a repayment they can count on for that period, which matters more here than the freedom to overpay. It does come with limits — extra repayments are capped while the fixed term runs, and breaking it early carries a cost — but${pi ? ' the balance still reduces month by month on principal and interest repayments.' : ' the rate is known for the whole of that period.'}`,
      `The rate is fixed for ${fixedYrs}, so ${who} know exactly what the repayment will be for that time regardless of what the market does. The trade-off is flexibility: additional repayments are limited during the fixed term and there is a break cost if the loan is repaid or refinanced before it ends.${pi ? ' The balance reduces throughout on principal and interest repayments.' : ''}`,
      `A fixed rate for ${fixedYrs} buys ${who} certainty — the repayment does not move, whichever way rates go. In return the loan is less flexible while the fixed term runs: there is a cap on extra repayments and a cost to break out of it early.${pi ? ' Principal and interest repayments still bring the balance down month by month.' : ''}`,
    ][v - 1]
  }

  // Variable, interest only.
  if (s.variable && s.interestOnly) {
    const base = [
      `Interest only repayments for the first ${ioYrs} keep the commitment as low as possible while ${who} settle in, with the balance untouched during that period and the repayment stepping up once it ends. The variable rate means they are free to pay more than the minimum at any point if they would rather start reducing the balance sooner, and to draw that money back out if circumstances change.`,
      `For the first ${ioYrs} the repayments cover interest only, which holds the monthly commitment down — the balance does not reduce in that time, and the repayment increases when the period ends. Because the rate is variable ${who} can pay above the minimum whenever they choose and redraw those extra payments if they need them.`,
      `The loan runs interest only for ${ioYrs}, keeping the required repayment at its lowest while it does, on the understanding that the balance stays where it is and the repayment rises afterwards. The variable rate leaves ${who} free to pay more than the minimum at any time, and free to take it back through redraw if things change.`,
    ][v - 1]
    if (!s.offset) return base + noOffsetTail(s, who, v)
    return base + ' ' + [
      `The offset account lets them park savings against the loan in the meantime, reducing the interest charged without tying the money up.`,
      `In the meantime the offset account cuts the interest charged on any savings held against the loan, and that money stays available.`,
      `The offset account adds to that: savings held against the loan reduce the interest charged and remain available whenever they need them.`,
    ][v - 1]
  }

  // Variable, principal and interest — the common case.
  if (s.variable) {
    const base = [
      `The variable rate gives ${who} room to move — they can put extra money against the loan whenever they have it, draw it back out if they need it, and pay the loan out early without a break cost, accepting that the repayment will shift if rates do.${pi ? ' Paying principal and interest means the balance starts coming down from the first month rather than sitting where it is.' : ''}`,
      `A variable rate keeps the loan flexible for ${who}: extra repayments whenever they can manage them, redraw on anything they have paid ahead, and no penalty for clearing it early — with the trade-off that the repayment moves with the market.${pi ? ' Because the loan is principal and interest the balance reduces from the outset.' : ''}`,
      `${who} are on a variable rate, so nothing stops them paying the loan down faster, pulling those extra repayments back out through redraw if circumstances change, or clearing the loan altogether — though the repayment will follow the market up as well as down.${pi ? ' Principal and interest repayments chip away at the balance from month one.' : ''}`,
    ][v - 1]
    if (!s.offset) return base + noOffsetTail(s, who, v)
    return base + ' ' + [
      `The offset sits alongside that: whatever they hold in it reduces the balance they are charged interest on, and the money stays available to them.`,
      `The offset account works in the same direction, cutting the interest charged on money that remains theirs to draw on.`,
      `The offset account adds to that: savings held against the loan reduce the interest charged, and stay available whenever they need them.`,
    ][v - 1]
  }

  return ''
}

// NO OFFSET IS A POSITION, NOT AN OMISSION.
//
// On a basic product the redraw is the point, and the fee saving is the reason.
// The fee half only appears when the product records a nil annual fee - Fabio
// wanted the trade-off stated, and a saving nobody recorded is not a fact.
function noOffsetTail(s: Structure, who: string, v: 1 | 2 | 3): string {
  if (!s.noAnnualFee) {
    return ' ' + [
      ` The product does not include an offset account; on a variable rate the redraw facility does much the same job, since anything paid ahead of the minimum reduces the interest charged straight away and can be taken back out when it is needed.`,
      ` There is no offset account on this product. The free redraw available on a variable rate covers the same ground — surplus funds paid into the loan cut the interest charged immediately and remain available.`,
      ` This loan comes without an offset account, but because the rate is variable, money held ahead in the loan still works to reduce the interest charged and can be drawn back if it is needed.`,
    ][v - 1].trim()
  }
  return ' ' + [
    `The recommended product does not include an offset account, and that is the trade-off for a loan with no ongoing annual fee. On a variable rate the redraw facility does much the same job for ${who} — every dollar paid ahead of the minimum cuts the interest charged straight away, and it stays available to be drawn back out if circumstances change.`,
    `There is no offset account on this product. What it does have is no ongoing annual fee, and free redraw on the variable rate, which together cover the same ground — surplus funds paid into the loan reduce the interest charged immediately and can be taken back out when ${who} need them, without the cost of carrying a packaged product.`,
    `This loan comes without an offset account, balanced against having no ongoing annual fee to pay. Because the rate is variable, redraw is available at no cost, so money held ahead in the loan still works to reduce the interest charged and can be drawn back if it is needed.`,
  ][v - 1]
}

// ---------------------------------------------------------------------------
// THE CLOSING LINE — who was recommended, and who they were weighed against
// ---------------------------------------------------------------------------

export function lendersLine(deal: any, v: 1 | 2 | 3): { text: string; gap?: Gap } {
  const lo = deal?.lo_data || {}
  const names: string[] = [...new Set<string>((lo.lenders || [])
    .map((l: any) => txt(l?.lenderName)).filter(Boolean))]
  const rec = txt(lo.recommendedLender) || names[0] || ''
  // THE BROKER'S OWN REASON, AS ITS OWN SENTENCE.
  //
  // It is written as whole sentences on the LO tab, so joining it onto a clause
  // with a comma produced "ING was the recommendation, They offer the most
  // competitive rate" - a comma splice into a capital letter, on a compliance
  // file. It follows as a separate sentence instead, in their words, untouched.
  const why = txt(lo.recommendationNote).replace(/\s+/g, ' ')
  const reason = why ? (/[.!?]$/.test(why) ? why : why + '.') : ''

  if (!rec) {
    return { text: shout('NO RECOMMENDED LENDER RECORDED — no lender has been marked as the recommendation on the lending options tab.'),
             gap: { what: 'No recommended lender', where: 'Lending options → recommended lender' } }
  }

  const others = names.filter(n => n !== rec)
  if (others.length === 0) {
    return { text: shout(`ONLY ONE LENDER RECORDED — ${rec} is the only lender option on this file, so the recommendation has not been compared against any alternative.`),
             gap: { what: 'Only one lender option recorded', where: 'Lending options → lender options' } }
  }

  const tail = reason ? ` ${reason}` : ''
  return { text: [
    `${rec} was recommended after comparing them against ${andList(others)}.${tail}`,
    `Of the lenders reviewed for this file — ${andList([rec, ...others])} — ${rec} was the recommendation.${tail}`,
    `We compared ${rec} against ${andList(others)} before recommending ${rec}.${tail}`,
  ][v - 1] }
}

// ---------------------------------------------------------------------------
// THE WHOLE BOX
// ---------------------------------------------------------------------------

export function boxOne(deal: any): BoxOne {
  const bc = deal?.bc_data || {}
  const lo = deal?.lo_data || {}
  const ff = deal?.fact_find_data || {}
  const row = dealRow(deal)
  const v = variantOf(deal?.id)
  const gaps: Gap[] = []
  const paras: string[] = []

  const apps = applicantsOf(deal, bc)
  const who = andList(apps.map(a => a.name.split(' ')[0]))
  const whoFull = andList(apps.map(a => a.name))

  // --- paragraph one: what they are borrowing, and why ---------------------
  const amount = loanAmount(deal)
  const term = splitsOf(deal).map(s => txt(s.termYears)).find(Boolean) || txt(bc.loanTerm)
  const lvr = lvrOf(deal)
  const purchase = readMoney(bc.purchasePrice)
  const isPurchase = /purchase|fhb|construction|bridging|buy/.test(txt(bc.template))

  const opening: string[] = []
  opening.push(`${whoFull} ${apps.length > 1 ? 'are' : 'is'} borrowing ${amount > 0 ? money(amount) : shout('NOT RECORDED — no loan amount has been recorded')}`)
  if (term) opening.push(` over a ${termInWords(term)} year term`)
  else gaps.push({ what: 'Loan term', where: 'BC → loan term' })
  opening.push(isPurchase
    ? ` to buy an owner-occupied property${txt(bc.suburb) ? ` in ${txt(bc.suburb)}` : ''}`
    : ` against ${txt(row.securityAddress) || 'the security recorded on this deal'}`)
  if (purchase && purchase > 0) opening.push(`, against a purchase price of ${money(purchase)}`)
  if (lvr !== null) opening.push(` — a loan to value ratio of ${lvr}%`)
  let p1 = opening.join('') + '.'

  // FIRST HOME BUYER — ONLY WHEN THE SCENARIO SAYS SO.
  //
  // Fabio, 10 Sep: "only mention first home buyer if we select the BC template
  // that says first home buyer. Otherwise never mention anything even if they
  // don't have property." Owning nothing is not evidence of anything.
  if (txt(bc.template) === 'fhb') p1 += ` ${who} are first home buyers.`

  const purpose = txt(ff.loanPurpose)
  if (purpose) {
    // Their sentence keeps its own full stop inside the quotes; ours is only
    // added when they did not write one. "...keep a buffer.". is not English.
    const said = purpose.replace(/\s+/g, ' ')
    p1 += ` In their own words, the reason for the loan is: "${said}${/[.!?]$/.test(said) ? '' : '.'}"`
  } else {
    p1 += ' ' + shout([
      "NOT RECORDED — the clients' own reason for seeking this loan has not been captured on the fact find. It must be obtained from the clients and recorded before this file is submitted.",
      'NOT RECORDED — nobody has recorded what these clients said they want the loan for. The fact find question is blank and must be completed before submission.',
      "NOT RECORDED — the clients' stated purpose for this loan is missing from the fact find and must be asked and recorded before this file goes any further.",
    ][v - 1])
    gaps.push({ what: "The clients' own reason for the loan", where: 'Fact Find → Purpose of loan' })
  }
  paras.push(p1)

  // --- paragraph two: the loan they have been recommended ------------------
  const s = structureOf(deal)
  const flex = flexibilityPassage(s, who, v)
  if (flex) {
    const named = s.lender && s.product
      ? `We have recommended ${s.lender}'s ${s.product}. `
      : s.lender ? `We have recommended ${s.lender}. ` : ''
    paras.push(named + flex)
  } else {
    paras.push(shout('NOT RECORDED — no rate type has been recorded against the recommended lender, so the structure of this loan cannot be described.'))
    gaps.push({ what: 'Rate type on the recommended lender', where: 'Lending options → recommended lender' })
  }

  // --- paragraph three: who they are, and where the money comes from -------
  // THE ONES WHO EARN COME FIRST.
  //
  // Reading "Natasha is not working and Richard is employed full time and earns
  // $446,429" leads with the absence. The earners lead, the rest follow after a
  // semicolon, which is also how a person would write it.
  const earners: string[] = []
  const idlers: string[] = []
  for (const a of (ff.applicants || [])) {
    const name = fullName(a)
    if (!name) continue
    const first = name.split(' ')[0]
    const jobs = currentEmployment(a)
    const idle = jobs.length > 0 && jobs.every((e: any) => notWorking(e))
    const job = jobs.find((e: any) => !notWorking(e))
    const inc = annualIncomeOfApplicant(a)
    if (idle || !job) { idlers.push(`${first} is not working`); continue }
    const occ = txt(job.occupation).toLowerCase()
    const how = [
      selfEmployed(job) ? 'self-employed' : 'employed',
      txt(job.employmentBasis).toLowerCase(),
      occ ? `as ${article(occ)} ${occ}` : '',
    ].filter(Boolean).join(' ')
    earners.push(`${first} is ${how}${inc > 0 ? ` and earns ${money(inc)} a year` : ''}`)
  }

  const p3: string[] = []
  const people = [andList(earners), andList(idlers)].filter(Boolean).join('; ')
  if (people) p3.push(people.replace(/^(.)/, c => c.toUpperCase()) + '.')
  const deps = txt(ff.dependants) || txt(bc.dependants)
  if (deps && deps !== '0') p3.push(`${earners.length + idlers.length ? 'They have' : `${who} have`} ${countInWords(deps)} dependant${deps === '1' ? '' : 's'}.`)

  // THE PROPERTY THAT IS BEING SOLD.
  //
  // The fact find records it and nothing has ever passed it on. On an upgrader
  // it is where most of the money comes from, so leaving it out forced anybody
  // reading the note to guess - and the note itself to guess, which is worse.
  const selling = (ff.properties || []).filter((p: any) => /sold|sell/i.test(txt(p?.futureUse)))
  for (const p of selling) {
    const val = readMoney(p?.value)
    const owing = (p?.loans || []).reduce((t: number, l: any) => t + (readMoney(l?.balance) ?? 0), 0)
    const lender = (p?.loans || []).map((l: any) => txt(l?.lenderName)).filter(Boolean)[0]
    p3.push(`Their property at ${txt(p?.address) || 'the address recorded on the fact find'} is recorded as being sold${val ? `; it is valued at ${money(val)}` : ''}${owing > 0 ? ` with ${money(owing)} still owing${lender ? ` to ${lender}` : ''}` : ''}.`)
  }

  const assets = (ff.assets || []).reduce((t: number, a: any) => t + (readMoney(a?.value) ?? 0), 0)
  const cash = (ff.assets || [])
    .filter((a: any) => /bank|savings|cash|term deposit/i.test(txt(a?.assetType)))
    .reduce((t: number, a: any) => t + (readMoney(a?.value) ?? 0), 0)
  const funds = fundsToComplete(deal)

  if (funds.applies && funds.workable && funds.toFind > 0 && assets > 0) {
    let line = `Their recorded assets come to ${money(assets)}${cash > 0 && cash < assets ? `, of which ${money(cash)} sits in bank accounts` : ''}, against ${money(funds.toFind)} needed to complete`
    if (selling.length && cash < funds.toFind) {
      line += `; the difference is expected to come from the sale.`
      p3.push(line)
      p3.push(shout([
        `NOT RECORDED — the net proceeds expected from the sale have not been recorded, so the funds to complete cannot be fully evidenced.`,
        `NOT RECORDED — no figure has been recorded for what the sale is expected to net, which leaves the source of the completion funds unevidenced.`,
        `NOT RECORDED — the expected net proceeds of the sale are missing from the file, so where the completion funds come from is not yet evidenced.`,
      ][v - 1]))
      gaps.push({ what: 'Expected net proceeds of the sale', where: 'Fact Find → the property being sold' })
    } else if (cash >= funds.toFind) {
      line += `, leaving ${money(cash - funds.toFind)} of recorded savings held after settlement.`
      p3.push(line)
    } else {
      line += '.'
      p3.push(line)
      p3.push(shout('NOT RECORDED — the recorded assets do not cover the funds to complete and no other source has been recorded.'))
      gaps.push({ what: 'Source of the funds to complete', where: 'Fact Find → assets, or the BC deposit source' })
    }
  } else if (txt(bc.depositSource)) {
    p3.push(`The funds to complete are recorded as coming from ${txt(bc.depositSource).toLowerCase()}.`)
  }

  if (p3.length) paras.push(p3.join(' '))

  // --- paragraph four: the lenders compared --------------------------------
  const line = lendersLine(deal, v)
  if (line.gap) gaps.push(line.gap)
  paras.push(line.text)

  return { text: paras.join('\n\n'), gaps, variant: v }
}
