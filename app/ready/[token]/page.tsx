import { notFound } from 'next/navigation'
import { verifyReady } from '@/lib/ready-link'
import Notify from './Notify'

// A client-facing page. It sits outside the (app) route group so it carries no
// sidebar or portal chrome, and /ready is on the middleware allowlist so a
// visitor with no login is never bounced to the sign-in screen.

export const metadata = { title: 'Simplify Finance' }

const STEPS: [string, string][] = [
  ['{broker} gives you a call',
   'We already have most of your details on file, so it’s a quick one to confirm a few finer points.'],
  ['We put your options together',
   'The lenders and rates that suit your situation, set out clearly in writing.'],
  ['You choose the one you like',
   'One short call to go through them, and we’re moving.'],
  ['We handle the rest',
   'The paperwork, the lender, the follow-up. We keep you posted at every step.'],
]

export default async function ReadyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const p = verifyReady(token)
  if (!p) notFound()

  const first = (p.brokerName || '').trim().split(/\s+/)[0] || 'Your broker'

  return (
    <div style={{ background: '#f5f5f3', minHeight: '100vh', padding: '32px 16px',
                  fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif' }}>
      <Notify token={token} />
      <div style={{ maxWidth: 520, margin: '0 auto', background: '#fff', border: '1px solid #E5DED2',
                    borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ background: '#343333', padding: '22px 20px', textAlign: 'center' }}>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>
            Simplify<span style={{ color: '#2DBEFF' }}>Finance.</span>
          </p>
          <p style={{ color: '#9E9E9E', fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', margin: '5px 0 0' }}>
            Finance, Simplified.
          </p>
        </div>

        <div style={{ padding: '26px 24px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F1F7F3',
                        border: '1px solid #CFE6D5', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 13px', color: '#1E7A4A', fontSize: 21 }}>✓</div>
          <h1 style={{ margin: '0 0 7px', fontSize: 19, fontWeight: 640, letterSpacing: '-.015em',
                       textAlign: 'center', color: '#221F1B' }}>
            Great news, {p.name} — {first} is on it
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#575046', lineHeight: 1.6, textAlign: 'center' }}>
            {first} has been notified and will call you within one business day.
          </p>

          <div style={{ borderLeft: '2px solid #EFEAE0', margin: '20px 0 0 11px', padding: '0 0 0 18px' }}>
            {STEPS.map(([h, d], i) => (
              <div key={i} style={{ position: 'relative', marginBottom: i === STEPS.length - 1 ? 0 : 15 }}>
                <span style={{ position: 'absolute', left: -25, top: 5, width: 11, height: 11,
                               borderRadius: '50%', background: '#fff', border: '2px solid #2DBEFF' }} />
                <div style={{ fontSize: 13.5, fontWeight: 620, marginBottom: 1, color: '#221F1B' }}>
                  {h.replace('{broker}', first)}
                </div>
                <div style={{ fontSize: 12.5, color: '#575046', lineHeight: 1.55 }}>{d}</div>
              </div>
            ))}
          </div>

          {p.calendly && (
            <div style={{ marginTop: 22, paddingTop: 19, borderTop: '1px solid #EFEAE0', textAlign: 'center' }}>
              <p style={{ fontSize: 13.5, fontWeight: 620, margin: '0 0 3px', color: '#221F1B' }}>
                Don&rsquo;t want to wait for the call?
              </p>
              <p style={{ fontSize: 12.5, color: '#575046', margin: '0 0 12px' }}>
                Pick a time that suits you and {first} will call then.
              </p>
              <a href={p.calendly}
                 style={{ display: 'block', textAlign: 'center', background: '#2DBEFF', color: '#fff',
                          padding: 13, borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
                Book a time with {first}
              </a>
            </div>
          )}

          <p style={{ fontSize: 12.5, color: '#575046', textAlign: 'center', margin: '16px 0 0' }}>
            Anything in the meantime, just reply to {first}&rsquo;s email.
          </p>
        </div>

        <div style={{ borderTop: '1px solid #EFEAE0', padding: '13px 24px', background: '#FCFAF6' }}>
          <p style={{ margin: 0, fontSize: 10.5, color: '#7A7266', lineHeight: 1.6 }}>
            Mortgage Specialists Pty Ltd trading as Simplify Finance. Australian Credit Licence 387025.
            The figures in your email are estimates and a guide only. Any refinance is subject to lender
            assessment and approval.
          </p>
        </div>
      </div>
    </div>
  )
}
