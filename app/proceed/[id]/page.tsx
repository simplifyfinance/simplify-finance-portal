import { notFound } from 'next/navigation'
import { loadProceed, stageFor, hasProceeded, buildNextStepsContent } from '@/lib/proceed-flow'
import { confirmProceed } from './actions'

// Opening this page reads the deal and nothing more. Until the client presses
// the button, no stage moves, no credit officer is allocated and nobody is
// emailed — which is what used to happen every time a mail scanner followed the
// link on its way to the inbox.
export default async function ProceedPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params
  const { from } = await searchParams

  const result = await loadProceed(id)
  if (!result.ok) return notFound()

  const { deal, wealthDeskLink } = result
  const stage = stageFor(deal, from)
  const done = hasProceeded(deal, stage)
  const clientName = deal.clients?.first_name || 'there'
  const { heading, steps } = buildNextStepsContent(stage, wealthDeskLink)

  async function submit() {
    'use server'
    await confirmProceed(id, stage)
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#F2E8DB', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '40px', maxWidth: '480px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '56px', height: '56px', backgroundColor: '#2DBEFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '22px', color: '#fff', fontWeight: 'bold' }}>{done ? '\u2713' : '\u2192'}</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#343333', margin: '0 0 6px' }}>
            {done ? `Great news, ${clientName}!` : `Ready to go ahead, ${clientName}?`}
          </h1>
          <p style={{ fontSize: '13px', color: '#666', margin: 0, lineHeight: '1.5' }}>
            {done
              ? "We're moving your application forward. Here's exactly what happens next."
              : "Here is what happens once you confirm. Nothing moves until you press the button below."}
          </p>
        </div>

        {!done && (
          <form action={submit} style={{ textAlign: 'center', marginBottom: '26px' }}>
            <button type="submit" style={{ backgroundColor: '#2DBEFF', color: '#fff', border: 0, padding: '13px 22px', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Yes, let&rsquo;s proceed
            </button>
          </form>
        )}

        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '13px', top: '30px', bottom: '30px', width: '2px', backgroundColor: '#e0e0e0' }} />

          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: i < steps.length - 1 ? '24px' : 0, position: 'relative' }}>
              <div style={{ width: '27px', height: '27px', borderRadius: '50%', backgroundColor: step.accent ? '#1D9E75' : '#343333', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0, zIndex: 1 }}>{step.num}</div>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#343333', fontSize: '14px' }}>{step.title}</p>
                <p style={{ margin: step.button ? '0 0 10px' : 0, color: '#666', fontSize: '12.5px', lineHeight: '1.6' }}>{step.desc}</p>
                {step.button && wealthDeskLink && (
                  <a href={wealthDeskLink} style={{ backgroundColor: '#1D9E75', color: '#fff', padding: '9px 16px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>Click here to share your bank statements</a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #eee', marginTop: '24px', paddingTop: '14px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#999' }}>Simplify Finance | ACL 387025 | St Leonards, Sydney</p>
        </div>

      </div>
    </div>
  )
}
