// Who ends up on the title, and who is borrowing without ending up on it.
//
// The portal recorded ownership of properties a client ALREADY had - a
// percentage per applicant on the fact find - and nothing at all about the
// security being bought. So on the Chapman file two people were borrowing
// $1,700,000 and the property was going into one name, and there was nowhere to
// say so and nothing that noticed.
//
// Fabio, 2 Sep 2026: "Natasha and Richard are applicants but property in
// Richards name only I dont think we have any flags for that and no where for
// my processing team to inform the bank of that strategy".
//
// A borrower who is not an owner is a question the lender always asks, so the
// answer belongs on the file rather than in somebody's head.

export type TitleHolder = { name: string; onTitle: boolean; share: string }
export type LegalAdvice = 'not_required' | 'arranged' | 'not_yet'

export type TitleInfo = {
  holders?: TitleHolder[]
  reason?: string
  legalAdvice?: LegalAdvice
}

export const LEGAL_ADVICE_LABEL: Record<LegalAdvice, string> = {
  not_required: 'not required',
  arranged: 'arranged',
  not_yet: 'not arranged yet',
}

const pct = (n: number): string => {
  if (n <= 0) return '0%'
  const share = 100 / n
  return (Math.round(share * 100) / 100).toString().replace(/\.00$/, '') + '%'
}

// Everyone on, split evenly. The overwhelmingly common answer, so a normal file
// is a glance and no typing - and a file that IS unusual has to be made unusual
// on purpose.
export function defaultHolders(applicantNames: string[]): TitleHolder[] {
  const names = (applicantNames || []).filter(Boolean)
  return names.map(name => ({ name, onTitle: true, share: pct(names.length) }))
}

// Applicants are added and removed after the compliance record is first built,
// so the stored list is reconciled against the live one rather than trusted.
export function holdersFor(info: TitleInfo | undefined | null, applicantNames: string[]): TitleHolder[] {
  const names = (applicantNames || []).filter(Boolean)
  const saved = info?.holders || []
  if (saved.length === 0) return defaultHolders(names)
  const byName = new Map(saved.map(h => [h.name, h]))
  return names.map(name => byName.get(name) || { name, onTitle: true, share: '' })
}

export function onTitle(info: TitleInfo | undefined | null, applicantNames: string[]): TitleHolder[] {
  return holdersFor(info, applicantNames).filter(h => h.onTitle)
}
export function notOnTitle(info: TitleInfo | undefined | null, applicantNames: string[]): TitleHolder[] {
  return holdersFor(info, applicantNames).filter(h => !h.onTitle)
}

// Is somebody borrowing who will not own the security?
//
// Nobody on title at all is NOT this. That is an unfinished form, not a
// strategy, and it gets its own message - telling someone "everyone is a
// non-owner borrower" would be nonsense.
export function borrowerNotOnTitle(info: TitleInfo | undefined | null, applicantNames: string[]): boolean {
  const holders = holdersFor(info, applicantNames)
  if (holders.length < 2) return false
  const owners = holders.filter(h => h.onTitle).length
  return owners > 0 && owners < holders.length
}

export function nobodyOnTitle(info: TitleInfo | undefined | null, applicantNames: string[]): boolean {
  const holders = holdersFor(info, applicantNames)
  return holders.length > 0 && holders.every(h => !h.onTitle)
}

// A reason is only owed when there is something to explain.
export function reasonRequired(info: TitleInfo | undefined | null, applicantNames: string[]): boolean {
  return borrowerNotOnTitle(info, applicantNames) && !String(info?.reason || '').trim()
}

const list = (names: string[]): string =>
  names.length <= 1 ? (names[0] || '') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]

// The handover box, as plain sentences. Not a table: a table does not survive a
// paste into SalesTrekker.
export function titleSummary(info: TitleInfo | undefined | null, applicantNames: string[]): string {
  const holders = holdersFor(info, applicantNames)
  if (holders.length === 0) return ''
  const owners = holders.filter(h => h.onTitle)
  const others = holders.filter(h => !h.onTitle)

  const parts: string[] = []
  parts.push(owners.length
    ? `**On title:** ${owners.map(h => h.share ? `${h.name} (${h.share})` : h.name).join(', ')}`
    : `**On title:** not recorded`)
  parts.push(`**Borrowing:** ${list(holders.map(h => h.name))}`)

  const reason = String(info?.reason || '').trim()
  if (others.length && reason) parts.push(reason)
  else if (others.length) {
    parts.push(`${list(others.map(h => h.name))} ${others.length === 1 ? 'is a borrower but will' : 'are borrowers but will'} not be on title. No reason has been recorded.`)
  }

  if (info?.legalAdvice) {
    parts.push(`**Independent legal advice:** ${LEGAL_ADVICE_LABEL[info.legalAdvice]}.`)
  }
  return parts.join('\n\n')
}
