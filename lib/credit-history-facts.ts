// WHAT THE PORTAL ACTUALLY ASKS ABOUT CREDIT HISTORY.
//
// The compliance prompt used to be handed every risk answer on the deal as raw
// JSON, keys and all, and told to "cover what was answered and nothing else".
// The one field on a regulated document where invention is least acceptable was
// the field most invited to invent: a blob to fish in.
//
// I ALSO GOT THIS WRONG ONCE, AND THE MISTAKE IS WORTH RECORDING.
//
// The first version of this file pointed at `creditImpairment` and
// `creditEnquiries`, taken from RISK_GROUPS in lib/handover-view.ts. Those are
// the two rows the handover screen and the compliance PDF PRINT - and nothing
// in this portal writes them. No form, no import, nowhere. They have rendered
// as an em dash on every deal ever.
//
// The questions the team actually answers are these five, on the Risks tab of
// the compliance screen, all of them required by preflight. Pointing the note
// at the wrong list would have made it report "nothing recorded" on every deal
// while five real answers sat one tab away.
//
// If a sixth is ever added to that tab it has to be added here too, deliberately.
// The list lives in ComplianceForm.tsx, under the "Credit history" heading.
//
// Fabio's rule for this tab: compose from what is recorded, never generate.

export type CreditAnswers = Record<string, any>

export const CREDIT_QUESTIONS: { key: string; label: string }[] = [
  { key: 'problemsMeetingCommitments', label: 'Problems meeting fixed commitments, including mobile payments' },
  { key: 'officerInLiquidation', label: 'Officer or shareholder of a company where a liquidator was appointed' },
  { key: 'unsatisfiedJudgements', label: 'Unsatisfied judgements in court' },
  { key: 'simultaneousApplications', label: 'Simultaneously applied to other credit providers' },
  { key: 'declaredBankrupt', label: 'Ever declared bankrupt' },
]

const txt = (v: any) => String(v ?? '').trim()

export type CreditHistory = {
  lines: string[]
  anythingAnswered: boolean
  allClear: boolean
}

export function creditHistoryFacts(risks: Record<string, CreditAnswers> | null | undefined,
                                   applicants: { name: string }[] | null | undefined): CreditHistory {
  const lines: string[] = []
  let answered = 0
  let clear = 0

  for (const applicant of (applicants || [])) {
    const who = txt(applicant?.name) || 'The applicant'
    const answers = (risks || {})[txt(applicant?.name)] || {}
    const parts: string[] = []
    for (const q of CREDIT_QUESTIONS) {
      const a = txt(answers[q.key])
      if (!a) { parts.push(`${q.label}: not answered`); continue }
      answered++
      // "Yes discharged" on the bankruptcy question is a Yes. It is a real
      // answer, it is not clear, and it is exactly the one a note must not
      // round down to nothing.
      if (a.toLowerCase() === 'no') clear++
      parts.push(`${q.label}: ${a}`)
    }
    lines.push(`${who} — ${parts.join('. ')}.`)
  }

  return {
    lines,
    anythingAnswered: answered > 0,
    // Every answer given must be No, and none may be missing. "Clean" on the
    // strength of a half-filled form is the claim that gets a file pulled apart.
    allClear: answered > 0 && clear === answered
                && answered === (applicants || []).length * CREDIT_QUESTIONS.length,
  }
}

export function creditHistoryBlock(h: CreditHistory): string {
  if (!h.anythingAnswered) {
    return 'WHAT IS RECORDED: nothing. The credit history questions on the Risks tab have not been answered on this deal.\n'
         + 'Say exactly that and nothing else. Do not describe the history as clean, and do not describe it as poor.'
  }
  return 'WHAT IS RECORDED, in full:\n' + h.lines.map(l => `- ${l}`).join('\n') + '\n\n'
    + 'These five questions are the whole of what this portal asks about credit history. '
    + 'Do not mention defaults, credit enquiries, credit impairment or a credit score: '
    + 'they are not asked and not recorded, so there is nothing to report about them either way.\n'
    + (h.allClear
        ? 'Every question is answered No for every applicant, so a clean history may be stated - '
          + 'on the basis of the client\'s declarations, noting they are declarations rather than a '
          + 'verified credit report and the credit team should confirm.'
        : 'Not every answer is No, or some are unanswered. Report what is there, name what is missing, '
          + 'and do not call the history clean.')
}
