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
