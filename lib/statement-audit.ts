// Every transaction, what CashDeck called it, and what we counted it as.
//
// This exists because the only way to check a figure used to be opening the
// workbook and building a pivot by hand. That is how the Viragova file was
// caught: $28,559 filed by CashDeck under "Wages" that our income figure knew
// nothing about — and, once we looked properly, eight of those eleven lines were
// savings interest that CashDeck had mis-filed. Both mistakes were invisible
// from the screen.
//
// The audit is derived from the cards themselves, not from a second run of the
// classifiers. If a transaction is not in a card's txnIds then no figure on the
// screen used it, whatever we might think it should have been. That means this
// view can never quietly disagree with the numbers it is auditing.

import type { ParsedTxn } from './statement-parse'

export type AuditFlag = 'differ' | 'uncounted' | 'agree' | 'expected'

export type AuditRow = {
  externalId: string
  date: string
  description: string
  merchant: string
  account: string
  institution: string
  amount: number
  cashdeck: string        // what the workbook called it
  ours: string[]          // titles of the cards that used it
  flag: AuditFlag
  why: string             // plain English, only when there is something to say
}

export type AuditCard = { key: string; title: string; txnIds: string[] }

// A family is a claim CashDeck makes about a line, and the cards that would be
// using that line if we agreed with it.
const FAMILIES: { name: string; cat: RegExp; cards: string[] }[] = [
  { name: 'wages',              cat: /wage|salary|payroll/i,                        cards: ['salary', 'runrate', 'gross', 'salaryVariance'] },
  { name: 'rent received',      cat: /^rent$|rental income/i,                       cards: ['rent', 'rentVariance'] },
  { name: 'a government payment', cat: /government|centrelink|benefit/i,            cards: ['govt'] },
  { name: 'a credit commitment', cat: /loan|credit card|buy now|wage advance|debt/i, cards: ['commitments', 'undisclosed', 'bnpl'] },
  { name: 'gambling',           cat: /gambl/i,                                      cards: ['gambling'] },
  { name: 'cash',               cat: /atm|withdrawal/i,                             cards: ['cash'] },
]

// Cards that only describe a balance or repeat a fact find figure never claim a
// transaction, so their absence proves nothing.
const NOT_A_CLAIM = new Set([
  'declaredSalary', 'declaredRent', 'declaredOther', 'declaredCommitments',
  'genuineSavings', 'savingsTrend', 'lowestBalance', 'overdrawn',
])

export function buildAudit(txns: ParsedTxn[], cards: AuditCard[]): AuditRow[] {
  const claimedBy = new Map<string, { key: string; title: string }[]>()
  for (const c of cards) {
    if (NOT_A_CLAIM.has(c.key)) continue
    for (const id of c.txnIds || []) {
      if (!claimedBy.has(id)) claimedBy.set(id, [])
      claimedBy.get(id)!.push({ key: c.key, title: c.title })
    }
  }

  const rows: AuditRow[] = txns.map(t => {
    const claims = claimedBy.get(t.externalId) || []
    const ours = [...new Set(claims.map(c => c.title))]
    const cat = `${t.category} ${t.summaryCategory}`.trim()
    const family = FAMILIES.find(f => f.cat.test(cat))

    let flag: AuditFlag = 'agree'
    let why = ''

    if (family) {
      const agreed = claims.some(c => family.cards.includes(c.key))
      if (!agreed) {
        flag = 'differ'
        why = ours.length
          ? `CashDeck filed this as "${t.category}". We counted it under ${ours.join(' and ')} instead.`
          : `CashDeck filed this as "${t.category}". No figure on this screen uses it.`
      }
    } else if (!ours.length) {
      // An uncounted credit is worth a look - it may be income, or it may be a
      // transfer between the client's own accounts. An uncounted debit is just
      // everyday spending and there is nothing to explain.
      flag = t.amount > 0 ? 'uncounted' : 'expected'
      if (flag === 'uncounted') why = 'Money in that no income figure counts. Either a transfer between their own accounts, or income we have not recognised.'
    }

    return {
      externalId: t.externalId, date: t.date,
      description: t.description, merchant: t.merchant,
      account: t.accountName, institution: t.institution,
      amount: t.amount,
      cashdeck: t.category || t.summaryCategory || '—',
      ours, flag, why,
    }
  })

  // Disagreements first, then uncounted money in, biggest first. Everything else
  // by date. The point of the screen is what is wrong, not what is fine.
  const rank: Record<AuditFlag, number> = { differ: 0, uncounted: 1, agree: 2, expected: 3 }
  return rows.sort((a, b) =>
    rank[a.flag] - rank[b.flag] ||
    (a.flag === 'uncounted' ? b.amount - a.amount : a.date.localeCompare(b.date)))
}

export function auditSummary(rows: AuditRow[]) {
  const differ = rows.filter(r => r.flag === 'differ')
  const uncounted = rows.filter(r => r.flag === 'uncounted')
  return {
    total: rows.length,
    differ: differ.length,
    differValue: round2(differ.reduce((s, r) => s + Math.abs(r.amount), 0)),
    uncounted: uncounted.length,
    uncountedValue: round2(uncounted.reduce((s, r) => s + r.amount, 0)),
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
