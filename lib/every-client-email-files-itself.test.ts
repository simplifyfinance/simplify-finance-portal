import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { bccForDeal, bccGap } from './files-itself-in-salestrekker'

// EVERY EMAIL TO A CLIENT FILES ITSELF AGAINST THE DEAL.
//
// 22 Oct 2026. An audit found two of eleven. The borrowing capacity and the
// lending options carried the SalesTrekker code; the five milestone letters,
// the next steps email and everything else did not. Each route writes its own
// call to Resend, so there was nothing in common to forget - and nothing to
// notice.
//
// So this test IS the list. A new route that sends to a client fails the build
// until somebody puts it on one side or the other.

// Sends to a client about a deal. Must read the deal's code.
const TO_A_CLIENT: Record<string, string> = {
  'app/api/send-milestone-email/route.ts': 'the five milestone letters',
  'app/api/send-next-steps-email/route.ts': 'next steps, after a stage moves',
}

// Sends mail, but not to a client about a deal. Each one needs a reason.
//
// Fabio, 22 Oct 2026: "no internal notifications just emails to clients". A
// SalesTrekker card should hold what the client was told, not our own traffic.
const NOT_TO_A_CLIENT: Record<string, string> = {
  'lib/salestrekker-notify.ts': 'every internal notification - card moves, filing, workload, reassignment',
  'lib/proceed-flow.ts': 'tells the broker a client pressed proceed; goes to us, never to them',
  'lib/allocate-officer.ts': 'workload and allocation, to our own credit team',
  'app/api/ready-notify/route.ts': 'tells the broker a client pressed get started; sent to us',
  'app/api/opportunity-notify/route.ts': 'tells the broker a client read the page; sent to us',
  'app/api/notify-broker-stage-complete/route.ts': 'asks our broker to review; internal',
  'app/api/reassign-broker/route.ts': 'tells our staff a deal moved to them',
  'app/api/reassign-credit-officer/route.ts': 'tells our staff a deal moved to them',
  'app/api/reassign-compliance-pack/route.ts': 'tells our own staff the compliance pack moved to them; no client is ever on it',
  'app/api/docs-received/route.ts': 'tells our staff to file documents; internal',
  'app/api/invite-user/route.ts': 'invites a staff member to the portal; no deal exists',
  'app/api/2fa/send/route.ts': 'the sign-in code, to one of us; no deal exists',
  // GOES TO A CLIENT, AND HAS NO DEAL BEHIND IT. Fabio, 22 Oct 2026: "on
  // templates folder only ones associated to deal as those are the one that
  // have bcc". The Templates page has no deal card, so there is no code to
  // read - it offers a BCC box to type into instead.
  'app/api/send-template-email/route.ts': 'the Templates page, which has no deal; it carries a typed BCC box',
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '_to_delete') continue
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

const SENDS = /api\.resend\.com\/emails/

describe('nothing new sends to a client without filing itself', () => {
  it('every sender is on one list or the other', () => {
    const senders = [...walk('lib'), ...walk('app')]
      .filter(f => SENDS.test(readFileSync(f, 'utf8')))
      .filter(f => !(f in TO_A_CLIENT) && !(f in NOT_TO_A_CLIENT))
    expect(senders,
      'this file sends email. Add the deal’s BCC with bccForDeal and list it in '
      + 'TO_A_CLIENT, or say in NOT_TO_A_CLIENT why a client never receives it.').toEqual([])
  })

  it('and the ones that go to a client really do read the deal’s code', () => {
    for (const file of Object.keys(TO_A_CLIENT)) {
      const src = readFileSync(file, 'utf8')
      expect(src, `${file} no longer reads the SalesTrekker code`).toContain('bccForDeal')
      // Either spelling: `bcc: [...]` or the shorthand `{ bcc }`.
      expect(src, `${file} reads it but never puts it on the email`)
        .toMatch(/bcc:\s|\{\s*bcc\s*\}/)
    }
  })

  it('the milestone screen says when it cannot file itself', () => {
    expect(readFileSync('app/api/send-milestone-email/route.ts', 'utf8')).toContain('bccGap')
  })
})

describe('what gets BCC’d, and what does not', () => {
  const deal = { salestrekker_bcc: 'deal-12345@salestrekker.com' }

  it('the deal’s own code, when there is one', () => {
    expect(bccForDeal(deal)).toEqual(['deal-12345@salestrekker.com'])
    expect(bccGap(deal)).toBe('')
  })

  it('nothing on a deal with no code, and it says so', () => {
    expect(bccForDeal({})).toEqual([])
    expect(bccForDeal({ salestrekker_bcc: '   ' })).toEqual([])
    expect(bccGap({})).toContain('will not file itself')
    expect(bccGap({})).toContain('SalesTrekker')
  })

  it('NEVER ON A TEST DEAL', () => {
    // A test deal turns the email round to the sender. Filing it would put a
    // test against a real client's card, which is worse than not filing it.
    expect(bccForDeal(deal, { redirected: true })).toEqual([])
    // And it does not nag about a code it would refuse to use anyway.
    expect(bccGap({}, { redirected: true })).toBe('')
  })
})
