import { creditHistorySentences, CLEAN_ORDER, CLEAN_WORDS } from './box-four'
import { variantOf, andList, type Gap } from './box-one'
import { CREDIT_QUESTIONS } from './credit-history-facts'
import { applicantsOf } from './applicants'

// BOX EIGHT — CREDIT HISTORY.
//
// The five questions on the Risks tab, per applicant, and nothing else.
//
// WE DO NOT PULL CREDIT REPORTS AND THIS BOX MUST NEVER IMPLY THAT WE DO.
// Fabio, 10 Sep 2026: "stop asking me if we did a credit check. We don't do
// Equifax. Don't mention that. You have enough questions and answers on the
// compliance sections to say someone is not bankrupt."
//
// So there is no "subject to a credit report", no "the credit file shows", no
// "declarations rather than a verified report" hedge. The declarations ARE the
// evidence this business works from, and the note says so plainly: on the
// answers recorded, we have no concerns. Where an answer is adverse it is
// reported and handed to the lender.
//
// The per-applicant sentences are creditHistorySentences() in box-four.ts,
// already built and tested there - reused rather than written twice, so the two
// boxes can never word the same five answers differently.

const txt = (v: any) => String(v ?? '').trim()
const shout = (s: string) => `** ${s} **`

export type Box = { text: string; gaps: Gap[]; variant: 1 | 2 | 3 }

// THE CONCLUSION, AND ONLY WHEN IT IS EARNED.
//
// "As far as we are concerned" is the point of the sentence: it is this
// business's position on the answers in front of it, not a claim about a credit
// file nobody has looked at.
const NO_CONCERNS: Record<1 | 2 | 3, string> = {
  1: 'On the basis of the answers recorded, there are no credit history concerns with this application as far as we are concerned.',
  2: 'On the answers recorded, we have no concerns with the credit history of any applicant on this application.',
  3: 'Based on the answers recorded, there is nothing in the credit history of this application that gives us cause for concern.',
}

// Every applicant has answered every question, and every answer is No.
export function allClear(deal: any): boolean {
  const risks = deal?.compliance_data?.risks || {}
  const apps = applicantsOf(deal, deal?.bc_data || {})
  if (apps.length === 0) return false
  for (const a of apps) {
    const r = risks[a.name]
    if (!r) return false
    for (const q of CREDIT_QUESTIONS) {
      const ans = txt((r as any)[q.key]).toLowerCase()
      // A blank is not a No, and "yes discharged" is not a No either.
      if (ans !== 'no') return false
    }
  }
  return true
}

export function boxEight(deal: any): Box {
  const v = variantOf(deal?.id)
  const apps = applicantsOf(deal, deal?.bc_data || {})
  const parts: string[] = []
  const gaps: Gap[] = []

  // NOBODY IS ON THE DEAL.
  //
  // applicantsOf() never returns an empty list - with nothing recorded anywhere
  // it falls back to a placeholder called "Applicant 1", which is right for a
  // form and wrong for a credit note: the sentence came out as "no credit
  // history answers have been recorded for Applicant." Caught by its own test,
  // 10 Sep 2026.
  if (apps.length === 0 || (apps.length === 1 && /^Applicant \d+$/.test(apps[0].name))) {
    return { text: shout('NOT RECORDED — nobody has been recorded as an applicant on this deal, so there is no credit history to report.'),
             gaps: [{ what: 'Applicants', where: 'Fact Find' }], variant: v }
  }

  // EVERYBODY CLEAN IS ONE SENTENCE, NOT ONE EACH.
  //
  // Per applicant, the clean wording is forty words long, and on a couple it
  // came out twice in a row, identical. Fabio on the compliance boxes: "the
  // sentences are very robotic. It needs to flow. It really needs to be obvious
  // that it's not an AI typing this." Two people who answered the same five
  // questions the same way are one sentence.
  if (allClear(deal)) {
    const said = CLEAN_ORDER.map(k => CLEAN_WORDS[k].replace(/^has /, 'have '))
      .join(', ').replace(/, ([^,]*)$/, ' and $1')
    const names = andList(apps.map(a => a.name.split(' ')[0]))
    parts.push(apps.length > 1
      ? `${names} have each confirmed that they ${said}.`
      : `${names} has confirmed that they ${said}.`)
    parts.push(NO_CONCERNS[v])
    return { text: parts.join(' '), gaps, variant: v }
  }

  const r = creditHistorySentences(deal)
  parts.push(...r.parts)
  gaps.push(...r.gaps)

  // The conclusion goes last, and only when every question is answered No for
  // everybody. A half-filled form does not get one - that is the claim that
  // gets a file pulled apart later.
  if (gaps.length === 0) {
    // Belt and braces: something is not clear but nothing was flagged. Rather
    // than fall silent, say which applicants the answers cover.
    parts.push(`The answers recorded above are the whole of what has been declared for ${andList(apps.map(a => a.name.split(' ')[0]))}.`)
  }

  return { text: parts.filter(Boolean).join(' '), gaps, variant: v }
}
