// Overruling the machine on a single line.
//
// The Audit tab shows what CashDeck called a transaction and what our figures
// did with it. Often the person reading it can see the answer and the system
// cannot: the $2,500 "Fast Transfer From MALGORZATA ZABLOCKA" that we counted as
// income is money moving between people, not earnings, and no rule was ever
// going to know that. Without this, spotting it meant coming back and changing
// code.
//
// Two reaches, and the difference matters:
//   - a correction on THIS file, which is always safe; and
//   - "always treat this payer this way", which changes how every other client's
//     statements are read and therefore has to be visible in Settings and
//     undoable from there.
// A correction on the file always beats a standing rule, because it was made by
// someone looking at that client.

import type { ParsedTxn } from './statement-parse'
import { normKey } from './statement-watchlists'

export type TreatAs = 'salary' | 'other_income' | 'not_income' | 'commitment' | 'ignore'

export const TREATMENTS: { id: TreatAs; label: string; help: string }[] = [
  { id: 'salary',       label: 'Salary',                    help: 'Counts towards net salary credits and the gross-up.' },
  { id: 'other_income', label: 'Other income',              help: 'Counts as income, but not as employment income.' },
  { id: 'not_income',   label: 'Not income — a transfer',   help: 'Money moving between accounts or from another person. Counts nowhere.' },
  { id: 'commitment',   label: 'A credit commitment',       help: 'Counts as a repayment and is matched against the fact find.' },
  { id: 'ignore',       label: 'Ignore this line',          help: 'Left out of every figure. Use for duplicates and bank artefacts.' },
]

export const TREATMENT_LABEL: Record<TreatAs, string> =
  Object.fromEntries(TREATMENTS.map(t => [t.id, t.label])) as Record<TreatAs, string>

export type Override = {
  external_id: string | null
  signature: string | null
  treat_as: TreatAs
  note?: string | null
  created_by?: string | null
  created_at: string
}

export type PayerRule = {
  match: string          // normalised payer key
  label: string          // what it looked like when the rule was made
  treat_as: TreatAs
  added_by: string | null
  added_at: string
  from_deal?: string | null
}

// A transaction keeps its external id from CashDeck, but a re-upload of the same
// statements can renumber. The signature is what the line IS - same day, same
// wording, same cents - so a correction is not silently lost when the client
// sends their statements again.
export function signatureOf(t: Pick<ParsedTxn, 'date' | 'description' | 'merchant' | 'amount'>): string {
  return `${t.date}|${normKey(`${t.description} ${t.merchant}`)}|${Math.round(Number(t.amount) * 100)}`
}

export type Resolved = { treat: TreatAs; source: 'file' | 'always'; label: string }

export function resolveOverrides(
  txns: ParsedTxn[],
  overrides: Override[],
  rules: PayerRule[],
  payerKeyOf: (t: ParsedTxn) => string,
): Map<string, Resolved> {
  const byId = new Map<string, Override>()
  const bySig = new Map<string, Override>()
  for (const o of overrides) {
    if (o.external_id) byId.set(o.external_id, o)
    if (o.signature) bySig.set(o.signature, o)
  }
  const ruleBy = new Map<string, PayerRule>()
  for (const r of rules) if (r.match) ruleBy.set(normKey(r.match), r)

  const out = new Map<string, Resolved>()
  for (const t of txns) {
    // The correction someone made on this file wins. It was made by a person
    // looking at this client, which a standing rule was not.
    const own = byId.get(t.externalId) || bySig.get(signatureOf(t))
    if (own) { out.set(t.externalId, { treat: own.treat_as, source: 'file', label: TREATMENT_LABEL[own.treat_as] }); continue }
    const rule = ruleBy.get(normKey(payerKeyOf(t)))
    if (rule) out.set(t.externalId, { treat: rule.treat_as, source: 'always', label: TREATMENT_LABEL[rule.treat_as] })
  }
  return out
}

// Adding a standing rule without removing the one it replaces would leave two
// rules for the same payer and no way to tell which won.
export function upsertRule(rules: PayerRule[], next: PayerRule): PayerRule[] {
  const k = normKey(next.match)
  return [...rules.filter(r => normKey(r.match) !== k), { ...next, match: k }]
}

export function removeRule(rules: PayerRule[], match: string): PayerRule[] {
  const k = normKey(match)
  return rules.filter(r => normKey(r.match) !== k)
}
