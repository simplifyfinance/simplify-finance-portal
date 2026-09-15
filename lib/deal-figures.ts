// THE FIGURES A NOTE OR AN EMAIL WAS WRITTEN FROM, EACH WITH A NAME.
//
// Everything the portal writes - the compliance notes, the client email - is
// written from the fact find at a moment in time and then saved. When somebody
// goes back and changes a figure afterwards, what was written is quietly wrong.
//
// The portal already noticed this, for six things: the lender, the loan amount,
// the purpose, the funds to complete, the approval type and the product. Change
// one of those and it says so by name. Change ANYTHING ELSE - a credit card
// limit, an income, a property value - and all it could say was
//
//     "something in the fact find changed after this was written"
//
// which is true, and useless: you cannot decide whether a note needs redoing
// without knowing what moved. Fabio, 8 Sep 2026, on exactly this: "if we change
// the data in a fact find, we need to remind people to refresh."
//
// So this lists the figures BY NAME. Adding another is one line.

import { money, readMoney } from './money'
import { annualIncomeOfApplicant } from './income-calculations'
import { resolveLenderSplits } from './lo-splits'

const txt = (v: any) => String(v ?? '').trim()

// name -> what it was at the time. Empty values are kept, because "was blank,
// now $15,000" is a change worth hearing about.
export type Figures = Record<string, string>

const nameOf = (a: any, i: number) =>
  [a?.firstName, a?.lastName].map(txt).filter(Boolean).join(' ') || `Applicant ${i + 1}`

export function dealFigures(deal: any): Figures {
  const ff = deal?.fact_find_data || {}
  const out: Figures = {}

  // Each applicant's assessed income, by name - the figure every note and every
  // email quotes, and the one that has moved most often.
  ;(ff.applicants || []).forEach((a: any, i: number) => {
    // "Nothing typed yet" and "typed, and it comes to nothing" are different
    // things, and $0 has already cost this business a day of trust. An
    // applicant with no income rows at all says so in words.
    const hasRows = ((a?.income || []) as any[]).length > 0
    out[`${nameOf(a, i)}'s income`] = hasRows ? (money(annualIncomeOfApplicant(a)) || '$0') : 'nothing recorded'
  })

  out['the number of dependants'] = txt(ff.dependants) || 'not recorded'
  if (txt(ff.depositSource)) out['the deposit source'] = txt(ff.depositSource)

  // Liabilities, named the way the fact find names them. A credit card is its
  // limit; everything else is its balance - that is what each one is recorded by.
  ;(ff.liabilities || []).forEach((l: any) => {
    const kind = txt(l?.liabilityType) || 'liability'
    const lender = txt(l?.lenderName)
    const label = `the ${kind.toLowerCase()}${lender ? ` with ${lender}` : ''}`
    const figure = kind === 'Credit card' ? l?.limitAmount : l?.balance
    out[kind === 'Credit card' ? `${label} limit` : `${label} balance`] = money(figure) || 'nothing recorded'
  })

  // Properties, and what is owed against them.
  ;(ff.properties || []).forEach((p: any) => {
    const where = txt(p?.address) || 'a property'
    out[`the value of ${where}`] = money(p?.value) || 'nothing recorded'
    ;(p?.loans || []).forEach((l: any) => {
      const lender = txt(l?.lenderName) || 'a lender'
      const bal = money(l?.balance)
      out[`the ${lender} loan on ${where}`] = bal || money(l?.limitAmount) || 'nothing recorded'
    })
  })

  // AND THE LENDING OPTIONS, WHICH THIS USED TO IGNORE ENTIRELY.
  //
  // 16 Sep 2026. Fabio: "staff will adjust LO and FF data as they go" - so how
  // does a compliance box written on Monday avoid quietly describing Monday's
  // deal on Friday?
  //
  // The portal already stamps every box with what it was written from and marks
  // it stale by name when those facts move. But what it watched was the fact
  // find and six headline facts, and nothing else. Change a rate on a split, a
  // fee, a product name or a turnaround and NOTHING went stale: nine paragraphs
  // sat there naming figures the deal no longer held, looking completely
  // normal.
  //
  // These are the figures the compliance prose actually quotes - box five names
  // the rate, the fees, the offset and the approval time; box four names the
  // product. If one of them moves, the box that named it is out of date.
  Object.assign(out, loRecordFigures(deal?.lo_data))

  return out
}

// THE RATES ARE ON THE SPLITS. See lib/lender-comparison.ts, 15 Sep 2026 - a
// lender card has four rate boxes at the top and a Rate box on every split
// underneath, and the team fills in the splits. Reading only the boxes at the
// top is what made every compliance box quote "NOT RECORDED" for a deal whose
// rates were all there.
function loRecordFigures(lo: any): Figures {
  const out: Figures = {}
  if (!lo || typeof lo !== 'object') return out

  ;(lo.lenders || []).forEach((l: any, i: number) => {
    const who = txt(l?.lenderName) || `lender ${i + 1}`
    if (txt(l?.productName)) out[`${who}'s product`] = txt(l.productName)
    if (txt(l?.approvalDays)) out[`${who}'s approval turnaround`] = txt(l.approvalDays)
    if (txt(l?.offsetAccount)) out[`${who}'s offset account`] = txt(l.offsetAccount)

    // Fees are typed as free text in the lender library - "$0", "$395/yr", "350"
    // - so they are compared exactly as stored rather than tidied, which would
    // make a formatting change look like a price change.
    if (txt(l?.annualFee))      out[`${who}'s annual fee`]      = txt(l.annualFee)
    if (txt(l?.applicationFee)) out[`${who}'s application fee`] = txt(l.applicationFee)
    if (txt(l?.valuationFee))   out[`${who}'s valuation fee`]   = txt(l.valuationFee)
    if (txt(l?.legalFee))       out[`${who}'s legal fee`]       = txt(l.legalFee)

    // Named by the split's own label so two options do not collide, and so the
    // sentence a person reads says which loan moved.
    resolveLenderSplits(l, lo.refinanceSplits).forEach((sp: any, j: number) => {
      const which = txt(sp?.label) || `split ${j + 1}`
      const where = `${who}'s ${which}`
      if (txt(sp?.rate)) out[`${where} rate`] = `${txt(sp.rate)}%`
      if (txt(sp?.repayment)) out[`${where} repayment`] = money(sp.repayment) || txt(sp.repayment)
      if (txt(sp?.repaymentType)) out[`${where} repayment type`] = txt(sp.repaymentType)
      if (txt(sp?.amount)) out[`${where} amount`] = money(sp.amount) || txt(sp.amount)
    })

    // The rate boxes at the top, still read for a lender recorded the older way.
    for (const [key, label] of [['variablePI', 'variable P&I'], ['variableIO', 'variable interest only'],
                                ['fixedPI', 'fixed P&I'], ['fixedIO', 'fixed interest only']] as [string, string][]) {
      const m = l?.[key]
      if (!m?.enabled) continue
      if (txt(m.rate)) out[`${who}'s ${label} rate`] = `${txt(m.rate)}%`
      if (txt(m.repayment)) out[`${who}'s ${label} repayment`] = money(m.repayment) || txt(m.repayment)
    }
  })

  return out
}

export type FigureChange = { name: string; was: string; now: string; sentence: string }

// What moved, said the way a person would say it.
export function figureChanges(was: Figures | undefined, now: Figures): FigureChange[] {
  if (!was) return []
  const out: FigureChange[] = []
  for (const name of Object.keys(now)) {
    const before = txt(was[name]), after = txt(now[name])
    // A figure that did not exist when this was written is not a change to it -
    // it is a new applicant or a new property, and the fingerprint catches that.
    if (!(name in was) || before === after) continue
    out.push({ name, was: before, now: after, sentence: `${name} changed from ${before} to ${after}` })
  }
  // Something that has gone entirely - a liability paid out, a property sold.
  for (const name of Object.keys(was)) {
    if (name in now) continue
    out.push({ name, was: txt(was[name]), now: '', sentence: `${name} was ${txt(was[name])}, and is no longer on the fact find` })
  }
  return out
}

// WHICH NOTES ACTUALLY MENTION THE FIGURE THAT MOVED.
//
// Fabio, 8 Sep 2026: "if I refresh, I don't want it to start completely
// everything again." So rather than calling nine boxes stale, say which ones
// have the old number written into them.
//
// A POINTER, NOT A GUARANTEE. It finds the figure in the text. It cannot know
// that a note saying "the card is being closed" is about the card that changed
// without mentioning the amount. The wording on screen says so.
export function notesMentioning(change: FigureChange, boxes: { key: string; label: string; text: string }[]): string[] {
  const needle = txt(change.was)
  if (!needle || needle === 'nothing recorded' || needle === 'not recorded') return []
  // Written both ways in practice - "$15,000" in prose, "15,000" in a table.
  const bare = needle.replace(/^\$/, '')
  const n = readMoney(needle)
  const forms = [needle, bare, n === null ? '' : String(n)].filter(Boolean)
  return boxes
    .filter(b => forms.some(f => txt(b.text).includes(f)))
    .map(b => b.label)
}

// THE FIGURES A LENDING OPTIONS EMAIL QUOTES.
//
// Natasha & Richard Chapman, 9 Sep 2026. The saved email told them CBA at
// 6.09% and $10,291 a month. The deal said 6.07% and $10,269. Somebody
// corrected the rate after the email was written and it was never rebuilt - and
// by the time anybody noticed, the deal was five days into Compliance Sent.
//
// The BC email has had this check since 8 Sep. The LO never got it: it checks
// only that the SCENARIO has not changed, which on that deal it had not. So the
// preview looked perfectly healthy while quoting a rate the portal did not
// hold.
//
// A rate and a repayment matter more here than anywhere else in the portal.
// They are what the client decides on.
export function loFigures(lo: any): Figures {
  const out: Figures = {}
  const t = (v: any) => String(v ?? '').trim()

  out['the loan amount'] = money(lo?.loanAmount) || 'nothing recorded'
  if (t(lo?.purchasePrice)) out['the purchase price'] = money(lo.purchasePrice)
  if (t(lo?.deposit)) out['the deposit'] = money(lo.deposit)
  if (t(lo?.stampDuty)) out['the stamp duty'] = money(lo.stampDuty)
  if (t(lo?.existingLoan)) out['the existing loan balance'] = money(lo.existingLoan)
  // Changing which lender is recommended rewrites the point of the email.
  out['the recommended lender'] = t(lo?.recommendedLender) || 'not chosen yet'

  const RATES: [string, string][] = [
    ['variablePI', 'variable P&I'], ['variableIO', 'variable interest only'],
    ['fixedPI', 'fixed P&I'],       ['fixedIO', 'fixed interest only'],
  ]

  ;(lo?.lenders || []).forEach((l: any, i: number) => {
    const who = t(l?.lenderName) || `lender ${i + 1}`
    for (const [key, label] of RATES) {
      const m = l?.[key]
      // Only the rate types actually being offered. An untouched fixed module
      // sitting at blank is not a figure anybody was told.
      if (!m?.enabled) continue
      if (t(m.rate)) out[`${who}'s ${label} rate`] = `${t(m.rate)}%`
      if (t(m.repayment)) out[`${who}'s ${label} repayment`] = money(m.repayment) || t(m.repayment)
      if (t(m.loanTerm)) out[`${who}'s ${label} term`] = `${t(m.loanTerm)} years`
    }
    // Fees are typed as free text in the lender library - "$0", "$395/yr", "350"
    // - so they are compared exactly as they are stored rather than tidied,
    // which would make a formatting change look like a price change.
    if (t(l?.applicationFee)) out[`${who}'s application fee`] = t(l.applicationFee)
    if (t(l?.annualFee))      out[`${who}'s annual fee`]      = t(l.annualFee)
    if (t(l?.valuationFee))   out[`${who}'s valuation fee`]   = t(l.valuationFee)
    if (t(l?.legalFee))       out[`${who}'s legal fee`]       = t(l.legalFee)
  })

  return out
}
