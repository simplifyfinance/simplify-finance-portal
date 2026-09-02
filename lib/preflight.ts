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

export type FindingKind = 'name' | 'placeholder' | 'hem' | 'title' | 'risks'
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

// --- names ------------------------------------------------------------------
//
// Only names the deal already knows are looked for. Guessing at capitalised
// words would flag every lender and suburb in the file.

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

export function applicantNames(compliance: any): string[] {
  return (compliance?.applicants || []).map((a: any) => String(a?.name || '').trim()).filter(Boolean)
}

const firstNameOf = (full: string) => String(full || '').trim().split(/\s+/)[0] || ''

// A whole word, so "Richard" does not match "Richardson" and "Ann" does not
// match "Anniversary".
function mentions(text: string, name: string): boolean {
  if (!name) return false
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${safe}\\b`, 'i').test(text)
}

function firstSentenceWith(text: string, name: string): string {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`[^.!?\\n]*\\b${safe}\\b[^.!?\\n]*[.!?]?`, 'i')
  const m = text.match(re)
  return (m?.[0] || '').trim().slice(0, 240)
}

// --- placeholders -----------------------------------------------------------
// Left in and copied into SalesTrekker exactly as written. Chapman's Security
// box says "TBA".
const PLACEHOLDERS = [/\bTBA\b/i, /\bTBC\b/i, /\bXXX+\b/i, /\bTODO\b/i, /\[[^\]\n]{2,40}\]/]

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
  const others = peopleOnDeal(deal, compliance).filter(p => !apps.includes(p))

  for (const { key, label } of TEXT_BOXES) {
    const text = String(compliance?.[key] || '')
    if (!text.trim()) continue

    // Someone named who is not a recorded applicant.
    const strangers = others.filter(p => mentions(text, firstNameOf(p)) || mentions(text, p))
    if (strangers.length) {
      const who = strangers.join(', ')
      const also = apps.filter(a => mentions(text, firstNameOf(a)))
      findings.push({
        kind: 'name', severity: 'warn', box: label,
        issue: also.length
          ? `Mentions ${who} and ${also.join(', ')} in the same box. ${apps.length === 1 ? 'Only ' + apps[0] + ' is' : 'Only ' + apps.join(' and ') + ' are'} recorded as ${apps.length === 1 ? 'an applicant' : 'applicants'}.`
          : `Mentions ${who}. ${apps.length === 1 ? 'The only applicant recorded on this file is ' + apps[0] : 'The applicants recorded on this file are ' + apps.join(' and ')}.`,
        snippet: firstSentenceWith(text, firstNameOf(strangers[0])),
        words: [...strangers.map(firstNameOf), ...also.map(firstNameOf)],
      })
    }

    const ph = placeholderIn(text)
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
  // recorded against them. That is the truth and it needs saying out loud - the
  // lender will ask, and a handover printed with half the applicants answered is
  // worse than one that admits it.
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
