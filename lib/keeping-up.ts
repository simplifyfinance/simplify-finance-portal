// KEEPING THE WRITE-UP AND THE FILED DOCUMENTS UP WITH THE DEAL.
//
// Fabio, 30 Sep 2026, on having to re-run the notes by hand after every lender
// change: "I want to be automatic and save on documents tab".
//
// TWO QUESTIONS, AND THEY ARE NOT THE SAME QUESTION.
//
//   1. May this box rebuild itself?  Only if it is COMPOSED - a pure function of
//      the deal - and only if nobody has touched it since it was composed.
//   2. Are the filed PDFs behind the deal?  Answered by comparing what they were
//      built from against what the deal says now.
//
// WHY "NOBODY HAS TOUCHED IT" IS THE WHOLE SAFETY ARGUMENT. A composed box is
// boxOne or boxFour run over the deal: same deal in, same words out, so
// rebuilding one cannot invent anything or lose anything. The moment somebody
// edits the wording, that stops being true - their sentence is not recoverable
// from the deal, and silently replacing it is destroying work on a regulated
// file.
//
// The stamp on each note has always recorded the FACTS it was written from. It
// did not record the TEXT, so there was no way to tell an untouched box from an
// edited one. That is what `textHash` adds, and why anything stamped before
// today is treated as touched: not knowing is a reason to leave it alone.

import { fingerprint, type NoteStamp } from './notes-freshness'
import { lenderOnTheDeal, optionOnTheDeal } from './client-agreement'
import { loanAmount } from './funds-to-complete'
import { purposeSummary } from './deal-structure'

const txt = (v: any) => String(v ?? '').trim()

// --- 1. may this box rebuild itself? ---------------------------------------

// Composed, rather than written by the model or typed by a person. The stamp
// says so in its own words at compose time - see COMPOSERS in ComplianceForm.
export function wasComposed(stamp: NoteStamp | undefined): boolean {
  return /^Composed from the deal/.test(txt(stamp?.source))
}

// UNTOUCHED SINCE IT WAS COMPOSED.
//
// False where there is no text, no stamp, or no textHash - the last of those
// being every note written before 30 Sep 2026. An unknown answer here has to
// mean "leave it alone", because the cost of being wrong is somebody's
// paragraph replaced without being asked.
export function untouchedSinceComposed(text: any, stamp: NoteStamp | undefined): boolean {
  const t = txt(text)
  const h = txt((stamp as any)?.textHash)
  if (!t || !h) return false
  return fingerprint(t) === h
}

export function safeToRecompose(text: any, stamp: NoteStamp | undefined): boolean {
  return wasComposed(stamp) && untouchedSinceComposed(text, stamp)
}

// Which of the composed boxes may be rebuilt on this deal right now. The caller
// passes what it holds; this decides, and nothing else does.
export function boxesToRebuild(
  fields: { field: string; text?: any }[],
  stamps: Record<string, NoteStamp> | undefined,
  stale: (field: string) => boolean,
): string[] {
  return (fields || [])
    .filter(f => stale(f.field) && safeToRecompose(f.text, stamps?.[f.field]))
    .map(f => f.field)
}

// What to say once some have been. Silence would be worse: a document that
// rewrote part of itself should say so, even when it was entitled to.
export function rebuiltLine(fields: string[], labels: Record<string, string>): string {
  if (!fields.length) return ''
  const names = fields.map(f => labels[f] || f)
  const list = names.length === 1 ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `Rebuilt from the deal: ${list}. Nothing you had edited was changed.`
}

// --- 2. are the filed documents behind the deal? ---------------------------

// WHAT A FILED PDF WAS BUILT FROM.
//
// Deliberately the few things that change what those documents SAY, rather than
// a hash of the whole deal - which would go stale on a typo in a phone number
// and teach everybody to ignore the warning.
export type BuiltFrom = {
  lender: string
  product: string
  loan: string
  purpose: string
  approval: string
  // The compliance write-up itself, so correcting a box marks the documents
  // behind too. They print it.
  writeUp: string
}

export function builtFrom(deal: any): BuiltFrom {
  const lo = deal?.lo_data || {}
  const c = deal?.compliance_data || {}
  const boxes = ['needsPrimary', 'needsImmediate', 'needsLongTerm', 'analysisComment',
                 'optionsComment', 'borrowingPowerComment', 'depositComment',
                 'creditHistoryComment', 'securityComment', 'applicationSubmissionComment']
  return {
    lender: lenderOnTheDeal(lo),
    product: txt(optionOnTheDeal(lo)?.productName),
    loan: String(loanAmount(deal) || ''),
    purpose: purposeSummary(deal),
    approval: c?.preApproval ? 'pre-approval' : 'formal',
    writeUp: fingerprint(boxes.map(k => txt(c?.[k])).join('\u0001')),
  }
}

// Behind, and what moved. Empty when the filed copies match the deal, and empty
// when nothing has ever been filed - there is no such thing as out of date
// before there is a copy.
export function documentsBehind(deal: any): string[] {
  const was = deal?.documents_built_from
  if (!was || typeof was !== 'object') return []
  const now = builtFrom(deal)
  const out: string[] = []
  const say = (label: string, a: any, b: any) => {
    const x = txt(a), y = txt(b)
    if (x === y) return
    if (!x) { out.push(`${label} is now ${y || 'not recorded'}`); return }
    if (!y) { out.push(`${label} was ${x} and is no longer recorded`); return }
    out.push(`${label} changed from ${x} to ${y}`)
  }
  say('the lender', (was as any).lender, now.lender)
  say('the product', (was as any).product, now.product)
  say('the loan amount', (was as any).loan, now.loan)
  say('the purpose', (was as any).purpose, now.purpose)
  say('the approval type', (was as any).approval, now.approval)
  if (txt((was as any).writeUp) !== now.writeUp) out.push('the compliance write-up was edited')
  return out
}

// "The filed copies are older than the deal - the lender changed from Macquarie
// to ubank." One sentence, because three warnings stacked up get skimmed.
export function behindLine(deal: any): string {
  const why = documentsBehind(deal)
  if (!why.length) return ''
  const list = why.length === 1 ? why[0]
    : `${why.slice(0, -1).join(', ')} and ${why[why.length - 1]}`
  return `The filed copies are older than the deal — ${list}.`
}

export function documentsAreCurrent(deal: any): boolean {
  return !!deal?.documents_built_from && documentsBehind(deal).length === 0
}
