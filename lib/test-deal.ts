// WHAT A TEST DEAL IS, IN ONE PLACE.
//
// A test deal is a deal somebody made to try something out. It behaves like a
// real one in every way that matters for testing - fact find, BC, lending
// options, compliance, the PDFs, the screens - and in no way that leaves a mark
// on the business:
//
//   it is counted nowhere,
//   its client emails come to the person testing instead of the client,
//   it never writes a lender rate observation.
//
// Five of them were sitting in the book on 18 September 2026 and one had
// already put a rate into lender_rate_observations, which is where the portal
// learns what lenders actually charge. Clearing them took four queries and a
// delete run by hand.
//
// EVERY SCREEN ASKS THIS FILE. That is the whole point of it being a file. The
// same mistake has been made six times now in this codebase - the same fact
// decided separately in two places, and the two allowed to disagree - and the
// answer each time has been to give the fact one home. This is that home for
// "is this a real deal".

export type DealLike = { is_test?: boolean | null } | null | undefined

// The rule. Anything that is not explicitly ticked is a real deal, which is the
// safe direction: a deal that has somehow lost its flag still counts, still
// reports, and still reaches its client. The failure we are preventing is a
// test deal being treated as real, never the reverse.
export function isTestDeal(deal: DealLike): boolean {
  return deal?.is_test === true
}

// What every counting screen uses: the workload page, the dashboard, the
// settlements list, the client's own page. One call, so none of them can drift.
// Deliberately unconstrained. Every screen has its own shape for a deal row -
// some list four columns, some select the lot - and a constraint here would mean
// every one of them had to declare is_test before it could ask the question.
// Rows go in and the same rows come out; the cast reads one optional field off
// them and nothing else.
export function realDealsOnly<T>(rows: T[] | null | undefined): T[] {
  return (rows || []).filter(r => !isTestDeal(r as DealLike))
}

export function testDealsOnly<T>(rows: T[] | null | undefined): T[] {
  return (rows || []).filter(r => isTestDeal(r as DealLike))
}

// WHERE A CLIENT EMAIL ACTUALLY GOES.
//
// Not "block it". If a test deal simply refused to send you could never check
// that an email looks right, which is half of what anybody tests. So it is
// built exactly as the client would receive it - real subject, real figures,
// real buttons - and sent to the person pressing the button instead. The
// client's address is never used.
//
// A test deal with nobody signed in has no address to fall back to, and the
// client's is not it. That send does not happen.
export function emailGoesTo(opts: {
  deal: DealLike
  clientEmail: string | null | undefined
  testerEmail: string | null | undefined
}): { to: string | null; redirected: boolean; insteadOf: string | null } {
  const client = String(opts.clientEmail || '').trim() || null
  if (!isTestDeal(opts.deal)) {
    return { to: client, redirected: false, insteadOf: null }
  }
  const tester = String(opts.testerEmail || '').trim() || null
  return { to: tester, redirected: true, insteadOf: client }
}

// The line that goes in front of a redirected subject, so an email sitting in
// your inbox is never mistaken for one a client received.
export function testSubject(subject: string): string {
  return `[TEST DEAL] ${subject}`
}

// A test deal teaches the portal nothing about lender pricing.
export function recordsRateData(deal: DealLike): boolean {
  return !isTestDeal(deal)
}

// TURNING IT BACK INTO A REAL DEAL IS ADMIN ONLY.
//
// Somebody will eventually tick the box on a live deal by mistake, so it has to
// be reversible. But going the other way - marking a real deal as a test - is
// how a deal quietly disappears from every report there is, so it is not a
// thing anybody can do on their own, and both directions are written onto the
// file.
export function canChangeTestFlag(role: string | null | undefined): boolean {
  return role === 'admin'
}

export function testFlagNote(nowATest: boolean): string {
  return nowATest
    ? 'Marked as a test deal. It is counted nowhere, its client emails come to whoever presses send, and it records no lender rate.'
    : 'Turned back into a real deal. It counts again, and it can email the client.'
}

export const TEST_DEAL_SUMMARY =
  'not counted anywhere · cannot email a client · records no lender rate'
