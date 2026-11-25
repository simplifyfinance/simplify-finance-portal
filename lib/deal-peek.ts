// What a person needs to know before deciding whether to open a deal.
//
// Fabio, 2 Sep 2026: a "binoculars" look from the board. It has one job — answer
// "does this need me today" — so everything on it is something already recorded
// somewhere. Nothing new to fill in, and nothing editable: it is a look, not a
// second place to change things.
//
// Statement figures are deliberately NOT on it. A score without its working is
// worse than no score, and Statements is a screen of its own with a button
// straight to it.

import { phaseOf, phaseSince, amountOf, PHASE_LABEL, type Phase } from './deal-phase'
// securityOf LIVES IN which-house.ts NOW, and is re-exported here so every
// existing caller keeps working. It moved because which-house needed it and
// importing it back the other way made a circle - which
// lib/the-files-do-not-import-each-other.test.ts refuses, correctly.
import { theHouseBeingBought, securityOf } from './which-house'
export { securityOf }
import { chipsFor, dealTitle, type Chip } from './deal-labels'
import { loanIdRows } from './loan-id'
import { OFFICE } from './same-date-everywhere'

export type PeekField = { key: string; value: string; muted?: boolean }
export type PeekSection = { title: string; fields: PeekField[] }

export type Peek = {
  title: string
  fullName: string
  phase: Phase
  phaseLabel: string
  chips: Chip[]
  loan: PeekSection
  security: PeekSection
  who: PeekSection
  dates: PeekSection
  notes: string
}

const dash = '—'

function auDate(v: any): string {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { timeZone: OFFICE, day: 'numeric', month: 'short', year: 'numeric' })
}

export function money(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return dash
  return '$' + Math.round(n).toLocaleString('en-AU')
}


export function buildPeek(deal: any, opts: { lenderName?: string; brokerName?: string; creditName?: string; colours?: { type?: any; use?: any } } = {}): Peek {
  // THE HOUSE BEING BOUGHT, NOT THE FIRST ONE ON THE FACT FIND.
  //
  // 25 Nov 2026. securityOf() above takes the first property with an address,
  // which on a purchase by somebody who already owns a house is THEIR house -
  // and on a buy-and-sell it is the one they are selling. The quick look said
  // so on every such deal. Same fault as the Isherwood handover, same fix.
  // See lib/which-house.ts.
  const sec = securityOf(deal)
  const boughtAddress = theHouseBeingBought(deal) || sec.address
  const applicants: string[] = (deal?.fact_find_data?.applicants || [])
    .map((a: any) => [a?.firstName, a?.lastName].map((x: any) => String(x || '').trim()).filter(Boolean).join(' '))
    .filter(Boolean)

  const clientName = applicants.length
    ? applicants.join(' & ')
    : [deal?.clients?.first_name, deal?.clients?.last_name].filter(Boolean).join(' ')

  return {
    title: dealTitle(deal?.deal_name || ''),
    fullName: String(deal?.deal_name || ''),
    phase: phaseOf(deal),
    phaseLabel: PHASE_LABEL[phaseOf(deal)],
    chips: chipsFor(deal, opts.colours),
    loan: {
      title: 'The loan',
      fields: [
        { key: 'Amount', value: money(amountOf(deal)), muted: amountOf(deal) === null },
        { key: 'Lender', value: opts.lenderName || dash, muted: !opts.lenderName },
        // The loan ID as it appears on the RCTI. It is what a settled deal is
        // matched against to mark the commission paid.
        //
        // It lives on the split it was issued against, one per split. This used
        // to read deals.lender_ref, which nothing has ever written - so it said
        // "not issued yet" on every deal in the portal and always would have.
        // lender_ref is still read last in case anything ever put one there.
        ...(() => {
          const ids = loanIdRows(deal).map(r => r.loanId).filter(Boolean)
          const value = ids.length ? ids.join(', ') : (String(deal?.lender_ref || '') || 'not entered yet')
          return [{ key: 'Loan ID', value, muted: ids.length === 0 && !deal?.lender_ref }]
        })(),
        { key: 'Settlement', value: auDate(deal?.settled_at) || auDate(deal?.confirmed_settlement_date) || auDate(deal?.expected_settlement_date) || 'not booked',
          muted: !(deal?.settled_at || deal?.confirmed_settlement_date || deal?.expected_settlement_date) },
      ],
    },
    security: {
      title: 'Security',
      fields: [
        { key: 'Address', value: boughtAddress || 'none recorded', muted: !boughtAddress },
        ...(sec.detail ? [{ key: 'Type', value: sec.detail }] : []),
        ...(sec.more > 0 ? [{ key: '', value: `+${sec.more} more ${sec.more === 1 ? 'property' : 'properties'} on the fact find`, muted: true }] : []),
      ],
    },
    who: {
      title: 'Who',
      fields: [
        { key: applicants.length > 1 ? 'Applicants' : 'Applicant', value: clientName || dash, muted: !clientName },
        { key: 'Broker', value: opts.brokerName || String(deal?.assigned_broker || '') || dash, muted: !opts.brokerName && !deal?.assigned_broker },
        { key: 'Credit', value: opts.creditName || 'not allocated', muted: !opts.creditName },
      ],
    },
    dates: {
      title: 'Dates',
      fields: [
        { key: 'Created', value: auDate(deal?.created_at) || dash, muted: !deal?.created_at },
        { key: 'BC sent', value: auDate(deal?.bc_sent_at) || dash, muted: !deal?.bc_sent_at },
        { key: 'Client agreed', value: auDate(deal?.proceeded_at) || (deal?.client_proceeded ? 'yes, date not recorded' : dash), muted: !deal?.client_proceeded },
        { key: 'Compliance sent', value: auDate(deal?.compliance_sent_at) || dash, muted: !deal?.compliance_sent_at },
      ],
    },
    notes: String(deal?.internal_notes || '').trim(),
  }
}

// How long it has been sitting where it is, in plain words.
export function peekAge(deal: any): string {
  const since = phaseSince(deal)
  if (!since) return ''
  const d = new Date(since)
  if (isNaN(d.getTime())) return ''
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  return days <= 0 ? 'today' : days === 1 ? '1 day in this column' : `${days} days in this column`
}
