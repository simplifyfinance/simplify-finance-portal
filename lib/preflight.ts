// What to check before a handover is printed.
//
// A handover is copied word for word into SalesTrekker by somebody who did not
// write it and is not in a position to notice that the wrong person is named in
// it. So the wrong name is copied too.
//
// Fabio, 2 Sep 2026, on the Chapman file: "second point I want that to be
// flagged BEFORE we print to PDF". Every check here fires on something real
// found on that deal.
//
// It warns. It never blocks. A person who knows the file is allowed to say the
// text is right - what they are not allowed to do is not be asked.

import { hemStateOf, type ExpenseCategory } from './hem'
import { borrowerNotOnTitle, nobodyOnTitle, notOnTitle, type TitleInfo } from './title'

export type FindingKind = 'pronoun' | 'placeholder' | 'hem' | 'title' | 'risks'
export type Finding = {
  kind: FindingKind
  box: string
  issue: string
  snippet?: string
  words?: string[]      // what to highlight inside the snippet
  severity: 'warn' | 'stop'
}

// The boxes that carry written text, in the order they appear on the handover.
export const TEXT_BOXES: { key: string; label: string }[] = [
  { key: 'needsPrimary', label: 'Primary reasons for seeking credit' },
  { key: 'needsImmediate', label: 'Immediate needs & objectives — next 2 years' },
  { key: 'needsLongTerm', label: 'Longer term — 2 to 10 years' },
  { key: 'analysisComment', label: 'Analysis, assessment & applicant education' },
  { key: 'optionsComment', label: 'Options presented & recommendation' },
  { key: 'borrowingPowerComment', label: 'Borrowing power' },
  { key: 'depositComment', label: 'Deposit / equity' },
  { key: 'creditHistoryComment', label: 'Credit history' },
  { key: 'securityComment', label: 'Security (property)' },
  { key: 'applicationSubmissionComment', label: 'Application submission' },
]

// --- one person, or two? ----------------------------------------------------
//
// This started as a check that flagged any NAME in the text that was not a
// recorded applicant. It was wrong twice over: the applicant list itself was
// broken (see lib/applicants.ts), so the second borrower was flagged in every
// box he appeared in - and naming the working applicant in a sentence about
// income is not an error, it is the correct thing to write.
//
// What IS wrong with the same text is the drift. Fabio's Chapman file opens
// "Clients are seeking..." - plural, correct for a couple - and two sentences
// later says "should she have upcoming expenses" and "her actual financial
// needs". A joint application written about as one woman goes to the lender
// that way. Fabio, 2 Sep 2026: "sentences start with clients we are referring to
// both".
//
// Only ever on a deal with two or more applicants. On a single applicant "she"
// is simply correct.

export function applicantNames(compliance: any): string[] {
  return (compliance?.applicants || []).map((a: any) => String(a?.name || '').trim()).filter(Boolean)
}

// Everyone the deal knows about. Kept because the title and risk checks read it.
export function peopleOnDeal(deal: any, compliance: any): string[] {
  const out = new Set<string>()
  const add = (v: any) => { const s = String(v || '').trim(); if (s) out.add(s) }
  for (const a of (compliance?.applicants || [])) add(a?.name)
  for (const a of ((deal?.fact_find_data || {}).applicants || [])) {
    add([a?.firstName, a?.lastName].filter(Boolean).join(' '))
  }
  const c = deal?.clients
  if (c) add([c.first_name, c.last_name].filter(Boolean).join(' '))
  return [...out]
}

const SINGULAR = /\b(she|her|hers|herself|he|him|his|himself)\b/i

export function singularPronounsIn(text: string): string[] {
  const found = new Set<string>()
  const re = new RegExp(SINGULAR.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) found.add(m[1].toLowerCase())
  return [...found]
}

function firstSentenceWith(text: string, needle: string): string {
  const safe = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`[^.!?\\n]*\\b${safe}\\b[^.!?\\n]*[.!?]?`, 'i')
  const m = text.match(re)
  return (m?.[0] || '').trim().slice(0, 240)
}

// --- placeholders -----------------------------------------------------------
// Left in and copied into SalesTrekker exactly as written. Chapman's Security
// box says "TBA".
const PLACEHOLDERS = [/\bTBA\b/i, /\bTBC\b/i, /\bXXX+\b/i, /\bTODO\b/i, /\[[^\]\n]{2,40}\]/]

// On a PRE-APPROVAL there is no property yet, so "TBA" against the security is
// the correct answer rather than an unfinished one. Fabio, 2 Sep 2026: "TBA is
// not an error on security as this is a pre-approval".
//
// Only the security box, and only on a deal marked as a pre-approval. A TBA left
// in the Analysis or the Deposit box is still somebody meaning to come back.
function placeholderExpected(boxKey: string, compliance: any): boolean {
  return boxKey === 'securityComment' && !!compliance?.preApproval
}

function placeholderIn(text: string): string {
  for (const re of PLACEHOLDERS) {
    const m = text.match(re)
    if (m) return m[0]
  }
  return ''
}

// --- the whole check --------------------------------------------------------

export function preflight(
  deal: any,
  compliance: any,
  expenseCategories: ExpenseCategory[] = [],
): Finding[] {
  const findings: Finding[] = []
  const apps = applicantNames(compliance)
  const joint = apps.length > 1

  for (const { key, label } of TEXT_BOXES) {
    const text = String(compliance?.[key] || '')
    if (!text.trim()) continue

    if (joint) {
      const pronouns = singularPronounsIn(text)
      if (pronouns.length) {
        findings.push({
          kind: 'pronoun', severity: 'warn', box: label,
          issue: `Written about one person on a joint application. `
               + `${apps.join(' and ')} are both applicants, so this should say "they" and "their".`,
          snippet: firstSentenceWith(text, pronouns[0]),
          words: pronouns,
        })
      }
    }

    const ph = placeholderExpected(key, compliance) ? '' : placeholderIn(text)
    if (ph) {
      findings.push({
        kind: 'placeholder', severity: 'warn', box: label,
        issue: 'Still a placeholder. This is copied straight into SalesTrekker as written.',
        snippet: firstSentenceWith(text, ph) || text.slice(0, 200),
        words: [ph],
      })
    }
  }

  // --- title ----------------------------------------------------------------
  const title: TitleInfo | undefined = compliance?.title
  if (nobodyOnTitle(title, apps)) {
    findings.push({
      kind: 'title', severity: 'stop', box: 'Security (property)',
      issue: 'Nobody is recorded as going on the title. That is an unfinished form rather than a strategy.',
    })
  } else if (borrowerNotOnTitle(title, apps)) {
    const off = notOnTitle(title, apps).map(h => h.name)
    const owners = apps.length - off.length
    const explained = !!String(title?.reason || '').trim()
    findings.push({
      kind: 'title', severity: explained ? 'warn' : 'stop', box: 'Security (property)',
      issue: explained
        ? `${apps.length} applicants, ${owners} on title. ${off.join(' and ')} ${off.length === 1 ? 'is' : 'are'} borrowing but will not own the security. The reason and the legal advice position are recorded and print on the handover.`
        : `${apps.length} applicants, ${owners} on title, and no reason recorded. The bank will ask why ${off.join(' and ')} ${off.length === 1 ? 'is' : 'are'} on the loan. Answer it before this goes out.`,
    })
  }

  // --- an applicant nobody has asked ----------------------------------------
  //
  // Compliance dropped the second applicant from every joint deal until 2 Sep
  // 2026, so the files that get fixed will suddenly show a person with nothing
  // recorded against them. That is the truth and it needs saying out loud.
  const RISK_KEYS = ['financialExperience', 'interestRateConcern', 'loanFlexibility', 'jobSecurity',
                     'propertyValueConcern', 'adverseChanges', 'beneficialChanges', 'retirementAge',
                     'repaymentMethod', 'emergencyFund', 'maintainLifestyle', 'adequateInsurance',
                     'hasWill', 'circumstancesImpact', 'problemsMeetingCommitments',
                     'officerInLiquidation', 'unsatisfiedJudgements', 'simultaneousApplications',
                     'declaredBankrupt']
  const unanswered = apps.filter(name => {
    const r = compliance?.risks?.[name] || {}
    return !RISK_KEYS.some(k => String(r[k] || '').trim())
  })
  if (unanswered.length && apps.length > 0) {
    findings.push({
      kind: 'risks', severity: 'stop', box: 'Risks',
      issue: `${unanswered.join(' and ')} ${unanswered.length === 1 ? 'has' : 'have'} no risk answers recorded. `
           + `The handover will say so, and the lender will ask.`,
    })
  }

  // --- HEM ------------------------------------------------------------------
  const open = expenseCategories
    .filter(c => c.askHem)
    .filter(c => hemStateOf(c, compliance?.expenses?.[c.key]) === 'unanswered')
  if (open.length) {
    findings.push({
      kind: 'hem', severity: 'warn', box: 'Living expenses',
      issue: `${open.map(c => c.label).join(' and ')} ${open.length === 1 ? 'has' : 'have'} no HEM answer. `
           + `${open.length === 1 ? 'It is' : 'Both are'} counted as in HEM on the handover until somebody decides.`,
    })
  }

  return findings
}

export function preflightHeadline(findings: Finding[]): string {
  const n = findings.length
  if (n === 0) return ''
  return `${n} thing${n === 1 ? '' : 's'} to check before the handover goes out`
}
