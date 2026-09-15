import { money, readMoney } from './money'
import { compareLenders, type Option } from './lender-comparison'
import { dealRow } from './deal-structure'
import { variantOf, andList, type Gap } from './box-one'

// BOX FIVE — OPTIONS PRESENTED & RECOMMENDATION.
//
// Everything comes off the Lending options tab, through lib/lender-comparison.ts
// which already compares the options and — the part that matters — separates out
// every point where the RECOMMENDED lender is not ahead. A credit assessor reads
// this box looking for exactly those, so they are stated rather than buried.
//
// IT NEVER ARGUES THE POINT AWAY. Where the recommendation is beaten on price it
// says so and stops. Saying the difference was "outweighed by" something would be
// this box forming a judgement, and the judgement is the broker's — recorded in
// their own note and quoted here word for word.
//
// AND IT NEVER CALLS SOMETHING CHEAPER WHEN IT IS NOT. A lender whose fee boxes
// are blank used to sum to $0 and be declared the cheapest. That is fixed in
// lender-comparison.ts: blank is now unknown, not free, and an unpriced option is
// named as unpriced instead of compared.
// Fabio, 10 Sep 2026: "not compare things say this is cheaper when it isnt."

const txt = (v: any) => String(v ?? '').trim()
const shout = (s: string) => `** ${s} **`

export type Box = { text: string; gaps: Gap[]; variant: 1 | 2 | 3 }

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
const inWords = (n: number) => COUNT[n] ?? String(n)

// "none", "nil", "n/a" and a blank all mean there is no cashback, and none of
// them is worth a sentence. Anything else is quoted as recorded.
export function cashbackOf(deal: any): string {
  const raw = txt(dealRow(deal).cashback)
  if (!raw) return ''
  if (/^(none|nil|n\/?a|no|0|\$0)$/i.test(raw)) return ''
  return raw
}

// ONE LINE PER ALTERNATIVE: NAME, PRODUCT, RATE. NOTHING ELSE.
//
// 15 Sep 2026. This box used to write a full sentence for every option - each
// one's rate, fees, offset and the credit officer's note - and then compare them
// all again underneath. On a two lender deal that was 228 words, most of it said
// twice. Fabio: "waaaay too long."
//
// The shape he asked for is four sentences: what else was looked at and its
// rate, what was chosen and why, how long it takes and that it suits them, and
// the features of the chosen product only.
function namedRate(o: Option): string {
  const named = `${o.name}${o.product ? ` ${o.product}` : ''}`
  if (o.lowestRate === null) return `${named} ${shout(`NOT RECORDED — no rate for ${o.name}`)}`
  return `${named} with an interest rate of ${o.lowestRate}%`
}

// THE CHOSEN PRODUCT, AND ONLY THE CHOSEN PRODUCT.
//
// Everything recorded against the recommended lender. A blank fee box is not a
// free one - see upfrontKnown/ongoingKnown in lender-comparison.ts - so an
// unpriced fee is left out rather than quoted as $0.
export function featureSentence(o: Option): string {
  const bits: string[] = []
  if (o.rates.length) {
    const lower = (l: string) => l.replace(/^(\w+)/, m => m.toLowerCase())
    bits.push(andList(o.rates.map(r => `${lower(r.label)} at ${r.rate}%`)))
  }
  // "not recorded" is not "no offset" - it is nobody having answered.
  if (o.offsetAnswer) bits.push(o.offset ? 'an offset account' : 'no offset account')
  if (o.ongoingKnown) bits.push(`an annual fee of ${money(o.ongoing)}`)
  if (o.upfrontKnown) bits.push(`${money(o.upfront)} in upfront fees`)
  if (bits.length === 0) return shout(`NOT RECORDED — nothing is recorded against ${o.name}'s product.`)
  return `The product is ${andList(bits)}.`
}

// HOW A TICKED RESEARCH CRITERION READS IN A SENTENCE.
//
// The seven boxes on the Lending options tab are written as headings -
// "Competitive interest rate", "Ability to have an offset account" - and a
// heading dropped straight into a sentence reads "selected ING based on
// competitive interest rate, ability to have an offset account". This is the
// same seven, written the way somebody would say them. Nothing is added to or
// taken from what was ticked; a criterion the broker typed in themselves is
// used exactly as they typed it.
const CRITERION_WORDING: Record<string, string> = {
  'Competitive interest rate': 'a competitive interest rate',
  'Good turnaround times': 'good turnaround times',
  'Ability to have an offset account': 'the ability to have an offset account',
  'Fully assessed pre-approval applications': 'fully assessed pre-approval applications',
  'Flexible with last 12 months bonus income': 'flexibility with last 12 months of bonus income',
  'Flexible with bridging finance': 'flexibility with bridging finance',
  'Flexible loan term policy': 'a flexible loan term policy',
}
const criterionWords = (c: string) =>
  CRITERION_WORDING[c] || c.replace(/^(\w+)/, m => m.toLowerCase())

export function boxFive(deal: any): Box {
  const v = variantOf(deal?.id)
  const lo = deal?.lo_data || {}
  const cd = deal?.compliance_data || {}
  const c = compareLenders(lo)
  const parts: string[] = []
  const gaps: Gap[] = []

  if (c.options.length === 0) {
    return { text: shout('NOT RECORDED — no lender options have been recorded on this deal.'),
             gaps: [{ what: 'Lender options', where: 'Lending options' }], variant: v }
  }

  const rec = c.options.find(o => o.recommended) || null
  const others = c.options.filter(o => !o.recommended)

  // --- 1. what else was looked at, rate only --------------------------------
  //
  // ONE OPTION IS NOT A COMPARISON, AND THE PORTAL DOES NOT PRETEND IT IS.
  // Fabio, 15 Sep 2026: "flag to broker only one product selected so THEY need
  // to elaborate that particular box as we dont have enough data to automate."
  if (others.length === 0) {
    parts.push(shout('ONLY ONE LENDER OPTION RECORDED — there is not enough on this deal to write '
      + 'this box. Please write it yourself, setting out what else was considered and why this '
      + 'product was chosen.'))
    gaps.push({ what: 'Only one lender option — this box has to be written by hand',
                where: 'Lending options' })
  } else {
    parts.push(`Lender options compared include ${andList(others.map(namedRate))}.`)
  }

  // --- 2. what was chosen, and why ------------------------------------------
  if (!rec) {
    parts.push(shout('NOT RECORDED — which lender was recommended.'))
    gaps.push({ what: 'Recommended lender', where: 'Lending options' })
  } else {
    const named = `${rec.name}${rec.product ? ` ${rec.product}` : ''}`
    if (c.criteria.length) {
      parts.push(`Ultimately we selected ${named} based on ${andList(c.criteria.map(criterionWords))}.`)
    } else {
      parts.push(`Ultimately we selected ${named}.`)
      parts.push(shout('NOT RECORDED — what the clients said mattered to them.'))
      gaps.push({ what: 'Research criteria', where: 'Lending options → research criteria' })
    }
  }

  // --- 3. how long it takes, and that it suits them -------------------------
  //
  // ALWAYS "in line with". On 10 Sep this had three wordings depending on
  // whether the recommended lender was faster, slower or the same as the others.
  // Fabio replaced that on 15 Sep: the recommendation is only ever made where it
  // suits the client, so the sentence says so plainly every time.
  if (rec) {
    if (rec.approvalText) {
      // Word for word as it was recorded. "1-2 business days" used to be read as
      // the number 12 and printed as "12 days" - see approvalRange in
      // lender-comparison.ts.
      const phrase = /^\d+$/.test(rec.approvalText) ? `${rec.approvalText} days` : rec.approvalText
      parts.push(`${rec.name}'s approval time is ${phrase}, `
        + `which is in line with the clients' goals and expectations.`)
    } else {
      parts.push(shout(`NOT RECORDED — how long ${rec.name} takes to approve.`))
      gaps.push({ what: 'Approval turnaround for the recommended lender', where: 'Lending options' })
    }
  }

  // --- 4. the features of the chosen product only ---------------------------
  if (rec) parts.push(featureSentence(rec))

  // --- cashback, when there is one ------------------------------------------
  // Fabio, 10 Sep 2026: "if the cashback box was input with a figure in deal
  // structure mention that."
  const cash = cashbackOf(deal)
  if (cash) {
    // ONLY A PLAIN FIGURE IS READ AS A FIGURE.
    //
    // readMoney strips everything that is not a digit, so "$2,000 after 6
    // months" came back as 20006 and the box said "A cashback of $20,006".
    // Caught by its own test, 10 Sep 2026. Anything carrying words is quoted
    // exactly as it was typed instead.
    const plain = /^\$?\s*[\d,]+(\.\d+)?$/.test(cash)
    const amount = plain ? readMoney(cash) : null
    parts.push(amount !== null && amount > 0
      ? `A cashback of ${money(amount)} has been recorded against this lending.`
      : `A cashback has been recorded against this lending: ${cash}.`)
  }

  // --- what the clients decided ----------------------------------------------
  const agreed = txt(cd.clientAgreedLender) || txt(lo.clientAgreedLender)
  if (agreed === 'Yes') {
    parts.push('The clients agreed with the recommendation and proceeded with it.')
  } else if (agreed === 'No') {
    const chosen = txt(cd.clientChosenLender) === '__other__'
      ? txt(cd.clientChosenLenderOther) : txt(cd.clientChosenLender)
    const reason = txt(cd.clientChosenLenderReason)
    parts.push(chosen
      ? `The clients did not proceed with the recommendation and chose ${chosen}.`
      : `The clients did not proceed with the recommendation. ${shout('NOT RECORDED — which lender they chose instead.')}`)
    if (!chosen) gaps.push({ what: 'The lender the clients chose instead', where: 'Compliance → Broker comments' })
    if (reason) parts.push(`Their reason, as recorded: "${reason.replace(/["]/g, "'").replace(/[.\s]+$/, '')}".`)
    else gaps.push({ what: 'Why the clients chose a different lender', where: 'Compliance → Broker comments' })
  } else {
    parts.push(shout("NOT RECORDED — whether the clients agreed with the recommendation."))
    gaps.push({ what: "The clients' agreement to the recommendation", where: 'Compliance → Broker comments' })
  }

  return { text: parts.filter(Boolean).join(' '), gaps, variant: v }
}
