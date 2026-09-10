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

// One sentence per option, from what is recorded and nothing else.
export function optionSentence(o: Option): string {
  const bits: string[] = []
  bits.push(`${o.name}${o.product ? `, on the ${o.product} product` : ''}`)

  if (o.rates.length) {
    // "Variable P&I" -> "a variable P&I rate of 5.99%". Only the first word is
    // lowered; blanket toLowerCase() turned P&I into p&i.
    const lower = (l: string) => l.replace(/^(\w+)/, m => m.toLowerCase())
    bits.push('at ' + andList(o.rates.map(r => `a ${lower(r.label)} rate of ${r.rate}%`)))
  } else {
    bits.push(shout(`NOT RECORDED — no rate for ${o.name}`))
  }

  const fees: string[] = []
  if (o.upfrontKnown) fees.push(`${money(o.upfront)} in upfront fees`)
  if (o.ongoingKnown) fees.push(`an annual fee of ${money(o.ongoing)}`)
  if (fees.length) bits.push('with ' + andList(fees))

  let s = bits.join(', ') + '.'

  const tail: string[] = []
  // "not recorded" is not "no offset" - it is nobody having answered.
  if (o.offsetAnswer) tail.push(o.offset ? 'The product has an offset account.' : 'The product has no offset account.')
  if (o.approvalDays !== null) tail.push(`Approval takes around ${o.approvalDays} days.`)
  if (o.note) tail.push(`Noted against this option: "${o.note.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '')}".`)
  if (tail.length) s += ' ' + tail.join(' ')
  return s
}

// APPROVAL TIME, AND WHAT THE DIFFERENCE MEANS.
//
// Fabio, 10 Sep 2026: "if days for approval of recommended product is lower than
// other products say something that we can achieve desired product and do it in
// a shorter time period; if higher than other products say customers are willing
// to wait as timeframe is secondary to features selected; if the same just
// mention that turnaround time of x days fits in line with customers timeframe
// and expectations."
//
// Only lenders with a turnaround actually recorded are compared - a blank is not
// a fast lender.
export function turnaroundLine(options: Option[], rec: string): string {
  const timed = options.filter(o => o.approvalDays !== null)
  const mine = timed.find(o => o.name === rec)
  if (!mine || mine.approvalDays === null) return ''
  const days = mine.approvalDays
  const others = timed.filter(o => o.name !== rec).map(o => o.approvalDays as number)

  if (others.length === 0) {
    return `The turnaround time of ${days} days fits in line with the clients' timeframe and expectations.`
  }
  const fastestOther = Math.min(...others)
  if (days < fastestOther) {
    return `At ${days} days, ${rec} also has the shortest turnaround of the options presented, `
         + 'so the clients can have the product recommended for them and have it in place sooner.'
  }
  if (days > fastestOther) {
    return `${rec} takes ${days} days against ${fastestOther} for the quickest of the other options. `
         + 'The clients are willing to wait, as the timeframe is secondary to the features they said mattered to them.'
  }
  return `The turnaround time of ${days} days fits in line with the clients' timeframe and expectations.`
}

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

  // --- what was presented ---------------------------------------------------
  parts.push(c.options.length === 1
    ? 'One lender option was presented to the clients.'
    : `${inWords(c.options.length).replace(/^\w/, m => m.toUpperCase())} lender options were presented to the clients.`)
  for (const o of c.options) parts.push(optionSentence(o))

  // --- what the clients said mattered --------------------------------------
  if (c.criteria.length) {
    parts.push(`The options were researched against what the clients said mattered to them: ${andList(c.criteria.map(x => x.toLowerCase()))}.`)
  } else {
    parts.push(shout('NOT RECORDED — what the clients said mattered to them.'))
    gaps.push({ what: 'Research criteria', where: 'Lending options → research criteria' })
  }

  // --- the recommendation ---------------------------------------------------
  const rec = txt(lo.recommendedLender)
  if (!rec) {
    parts.push(shout('NOT RECORDED — which lender was recommended.'))
    gaps.push({ what: 'Recommended lender', where: 'Lending options' })
  } else if (c.options.length === 1) {
    parts.push(`${rec} was recommended. ${shout('ONLY ONE LENDER RECORDED — the recommendation has not been compared against any alternative.')}`)
    gaps.push({ what: 'Only one lender option recorded', where: 'Lending options' })
  } else {
    parts.push(`${rec} was recommended.`)
    // Said plainly, in the comparison library's own words, wins and losses
    // together and in the same breath.
    //
    // The library's raw turnaround line is dropped here - box five says it in
    // Fabio's words instead, below, because what matters is not which lender is
    // fastest but what the difference means for the client.
    const said = c.lines.filter(l => !/^Fastest approval:/.test(l))
    if (said.length) parts.push(said.map(l => l.replace(/\s+/g, ' ').trim()).join(' '))
    const turn = turnaroundLine(c.options, rec)
    if (turn) parts.push(turn)
    for (const a of c.against) {
      gaps.push({ what: `The recommendation is behind on this — ${a.split(':')[0]}`, where: 'Lending options' })
    }
  }

  // --- the broker's own reason, quoted ---------------------------------------
  const why = txt(lo.recommendationNote).replace(/\s+/g, ' ').trim()
  if (why) {
    parts.push(`The reason recorded for the recommendation: "${why.replace(/["]/g, "'").replace(/[.\s]+$/, '')}".`)
  } else if (rec) {
    parts.push(shout('NOT RECORDED — why this lender was recommended.'))
    gaps.push({ what: 'Recommendation note', where: 'Lending options' })
  }

  // --- cashback, when there is one -------------------------------------------
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
