import { describe, it, expect, vi, beforeEach } from 'vitest'

// THE AUTOMATIC REQUEST, END TO END, WITHOUT A DATABASE OR AN EMAIL.
//
// 14 Sep 2026. The portal now asks for the documents itself the moment the client
// agrees to proceed. Nobody is watching a screen when it happens, so the three
// things that would be invisible are the three things tested here:
//
//   1. It does not ask for bank statements the client has already sent. That
//      filter used to live in the browser, which was fine while the browser was
//      the only thing that could start a request.
//   2. It refuses to record a request when there is nobody to send it to,
//      rather than marking the documents as asked for and telling no one.
//   3. It writes the record BEFORE the email, so a failed send can be pressed
//      again instead of silently skipping the client's next round.

const sendCalls: any[] = []
const patchCalls: any[] = []

vi.mock('./salestrekker-notify', () => ({
  notifyDocumentRequest: vi.fn(async (p: any) => {
    sendCalls.push(p)
    return p.recipientEmail === 'bounce@example.com'
      ? { ok: false, error: 'Resend refused' }
      : { ok: true }
  }),
}))

vi.mock('./patch-deal-column', () => ({
  patchDealColumn: vi.fn(async (_s: any, _id: string, _col: string, apply: any, fallback: any) => {
    const next = apply(fallback)
    patchCalls.push(next)
    return { next, problem: null }
  }),
}))

const { requestDocuments } = await import('./document-request')

// A PAYG purchase, which is the ordinary case.
const DEAL = {
  id: 'd1', deal_name: 'Chapman_Purchase_2026', assigned_broker: 'fabio',
  clients: { first_name: 'Sarah', last_name: 'Chapman' },
  document_progress: null, formal_approval_at: null,
  bc_data: { template: 'oo_purchase' },
  fact_find_data: {
    applicants: [{
      id: 'a1', firstName: 'Sarah', lastName: 'Chapman',
      addresses: [{ id: 'ad1', isCurrent: true, address: '12 Smith St', residentialStatus: 'Owner' }],
      employment: [{ id: 'e1', isCurrent: true, employmentType: 'PAYG', employerName: 'Aurecon' }],
      income: [],
    }],
    properties: [], liabilities: [], assets: [], depositSource: '',
  },
}

// A database that answers, and remembers nothing it was not given.
function db(over: any = {}) {
  const tables: any = {
    deals: { single: { data: over.deal === undefined ? DEAL : over.deal, error: null } },
    deal_statement_uploads: { list: { data: over.uploads || [] } },
    lenders: { list: { data: over.lenders || [] } },
    settings: { single: { data: over.settings === undefined
      ? { docs_request_notification_user_id: 'u-ellie', docs_file_notification_user_id: 'u-cris' }
      : over.settings, error: null } },
    user_profiles: { single: { data: over.profile === undefined
      ? { email: 'ellie@simplifyfinance.com.au', full_name: 'Ellie Whitcombe' }
      : over.profile, error: null } },
  }
  return {
    from(name: string) {
      const t = tables[name] || { list: { data: [] }, single: { data: null, error: null } }
      const chain: any = {
        select: () => chain,
        eq: () => (t.list ? Promise.resolve(t.list) : chain),
        single: async () => t.single || { data: null, error: null },
        then: (res: any) => Promise.resolve(t.list || { data: [] }).then(res),
      }
      // eq() on a single-row table must still allow .single() after it.
      chain.eq = () => (t.single ? chain : Promise.resolve(t.list))
      return chain
    },
  }
}

beforeEach(() => { sendCalls.length = 0; patchCalls.length = 0 })

describe('the portal asking for the documents by itself', () => {
  it('asks for the list the rules produced, and names who it went to', async () => {
    const r = await requestDocuments(db(), { dealId: 'd1', origin: 'proceed' })
    expect(r.ok).toBe(true)
    expect(r.sent).toBeGreaterThan(0)
    expect(r.to).toBe('Ellie Whitcombe')
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0].recipientEmail).toBe('ellie@simplifyfinance.com.au')
    expect(sendCalls[0].requestedBy).toMatch(/portal/i)
  })

  it('records what was asked for before the email leaves', async () => {
    // A record with no email can be pressed again. An email with no record asks
    // the client for the same things all over again next time.
    await requestDocuments(db(), { dealId: 'd1', origin: 'proceed' })
    expect(patchCalls).toHaveLength(1)
    expect(patchCalls[0].requests[0].keys.length).toBeGreaterThan(0)
    expect(patchCalls[0].requests[0].by).toMatch(/portal/i)
  })

  it('keeps the record when the email bounces, and says so', async () => {
    const r = await requestDocuments(
      db({ profile: { email: 'bounce@example.com', full_name: 'Ellie Whitcombe' } }),
      { dealId: 'd1', origin: 'proceed' })
    expect(r.ok).toBe(false)
    expect(r.recorded).toBe(true)
    expect(patchCalls).toHaveLength(1)
    expect(r.error).toMatch(/did not go out/i)
  })

  it('SENDS NOTHING AND RECORDS NOTHING when there is nobody to send it to', async () => {
    // The dangerous version of this bug marks every document as asked for and
    // tells no one, so the client is never chased and the list looks done.
    const r = await requestDocuments(db({ settings: {}, profile: null }),
      { dealId: 'd1', origin: 'proceed' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/no recipient/i)
    expect(patchCalls, 'it recorded a request nobody was told about').toHaveLength(0)
    expect(sendCalls).toHaveLength(0)
  })

  it('falls back to the person who files them when no requester is set', async () => {
    const r = await requestDocuments(
      db({ settings: { docs_file_notification_user_id: 'u-cris' } }),
      { dealId: 'd1', origin: 'proceed' })
    expect(r.ok).toBe(true)
    expect(sendCalls).toHaveLength(1)
  })

  it('says so plainly when the deal is not there', async () => {
    const r = await requestDocuments(db({ deal: null }), { dealId: 'nope', origin: 'proceed' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(404)
    expect(sendCalls).toHaveLength(0)
  })

  it('does not ask twice for what a previous round already asked for', async () => {
    const first = await requestDocuments(db(), { dealId: 'd1', origin: 'proceed' })
    const asked = patchCalls[0].requests[0].keys
    sendCalls.length = 0; patchCalls.length = 0

    const again = await requestDocuments(
      db({ deal: { ...DEAL, document_progress: { requests: [{ at: '2026-09-14T00:00:00Z', by: 'x', keys: asked }] } } }),
      { dealId: 'd1', origin: 'proceed' })

    expect(first.sent).toBeGreaterThan(0)
    expect(again.sent).toBe(0)
    expect(again.skipped).toBe(true)
    expect(sendCalls, 'the client was asked for the same documents twice').toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// THE ONE THAT MATTERS MOST.
//
// Fabio, 11 Sep 2026: "why would payslips be there if I am already requesting -
// eliminate double ups... ensure confirm rules around bank statements! If I drop
// bank statements in the statements tab I need to automatically cross them off
// the list."
//
// That crossing-off used to happen in the BROWSER, which filtered the list
// before posting it, so the route never needed to know. The moment the portal
// starts a request by itself there is no browser in the way - and without this
// the client is asked to send the ANZ statements they sent last week.

const DEAL_WITH_CARDS = {
  ...DEAL,
  fact_find_data: {
    ...DEAL.fact_find_data,
    liabilities: [
      { id: 'l1', liabilityType: 'Credit card', lenderName: 'ANZ' },
      { id: 'l2', liabilityType: 'Credit card', lenderName: 'Westpac' },
    ],
  },
}

const LENDERS = [
  { name: 'ANZ', statement_codes: 'anz' },
  { name: 'Westpac', statement_codes: 'wbc,westpac' },
]

describe('statements already on file', () => {
  it('asks for both cards when nothing has been uploaded', async () => {
    const r = await requestDocuments(db({ deal: DEAL_WITH_CARDS, lenders: LENDERS }),
      { dealId: 'd1', origin: 'proceed' })
    const labels = sendCalls[0].documents.map((d: any) => d.label)
    expect(r.ok).toBe(true)
    expect(labels).toContain('Credit card statement — ANZ')
    expect(labels).toContain('Credit card statement — Westpac')
    expect(r.covered).toEqual([])
  })

  it('does NOT ask for the ANZ card once ANZ statements have arrived', async () => {
    const r = await requestDocuments(db({
      deal: DEAL_WITH_CARDS, lenders: LENDERS,
      uploads: [{ institutions: ['anz'], period_from: '2026-03-01', period_to: '2026-09-01', days: 184 }],
    }), { dealId: 'd1', origin: 'proceed' })

    const labels = sendCalls[0].documents.map((d: any) => d.label)
    expect(labels, 'the client is being asked for statements they already sent')
      .not.toContain('Credit card statement — ANZ')
    expect(labels).toContain('Credit card statement — Westpac')

    // And it says WHY the list is short, so it does not read as incomplete.
    expect(r.covered).toContain('Credit card statement — ANZ')
  })

  it('crosses off nothing it cannot recognise, rather than guessing', async () => {
    // A code the lender library has never heard of must not quietly cross a
    // document off. The safe direction is the full list.
    const r = await requestDocuments(db({
      deal: DEAL_WITH_CARDS, lenders: LENDERS,
      uploads: [{ institutions: ['SOMEBANK'], period_from: '2026-03-01', period_to: '2026-09-01', days: 184 }],
    }), { dealId: 'd1', origin: 'proceed' })
    expect(r.covered).toEqual([])
    expect(sendCalls[0].documents.map((d: any) => d.label))
      .toContain('Credit card statement — ANZ')
  })

  it('sends only what is actually left once the statements are counted', async () => {
    // Not a guess: a bare purchase with one ANZ card produces exactly two rows,
    // the card and the expenses account. The expenses account names no bank, so
    // statements never cross it off - that is deliberate, see coveredRows().
    const onlyAnz = { ...DEAL, fact_find_data: { ...DEAL.fact_find_data, applicants: [],
      liabilities: [{ id: 'l1', liabilityType: 'Credit card', lenderName: 'ANZ' }] } }
    const r = await requestDocuments(db({
      deal: onlyAnz, lenders: LENDERS,
      uploads: [{ institutions: ['anz'], period_from: '2026-03-01', period_to: '2026-09-01', days: 184 }],
    }), { dealId: 'd1', origin: 'proceed' })

    const labels = sendCalls[0].documents.map((d: any) => d.label)
    expect(labels).toEqual(['Expenses account'])
    expect(r.covered).toContain('Credit card statement — ANZ')
    expect(r.sent).toBe(1)
  })
})
