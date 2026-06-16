import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'

export default async function ProceedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: deal } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name)')
    .eq('id', id)
    .single()

  if (!deal) return notFound()

  await supabase
    .from('deals')
    .update({ stage: 'LO', client_proceeded: true, proceeded_at: new Date().toISOString() })
    .eq('id', id)

  const clientName = deal.clients?.first_name || 'there'

  const steps = [
    { num: '1', title: 'Portal invitation', desc: "You'll receive an invitation to our secure client portal via email. This is where you'll upload your documents safely and easily." },
    { num: '2', title: 'Document upload', desc: 'Upload your supporting documents through the portal. Our team will review everything and keep you updated throughout the process.' },
    { num: '3', title: 'Lending options presented', desc: "Once we've reviewed your documents, we'll present your personalised lending options with rates, comparisons, and our recommendation." }
  ]

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#F2E8DB', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '48px', maxWidth: '560px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#2DBEFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px', color: '#fff', fontWeight: 'bold' }}>✓</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#343333', margin: '0 0 8px' }}>Great news, {clientName}!</h1>
          <p style={{ fontSize: '15px', color: '#666', margin: 0, lineHeight: '1.6' }}>Your broker has been notified and will be in touch shortly to guide you through the next steps.</p>
        </div>

        <div style={{ borderTop: '1px solid #eee', margin: '24px 0' }} />

        <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#343333', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 20px' }}>What happens next</h2>

        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#343333', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>{step.num}</div>
            <div>
              <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#343333', fontSize: '14px' }}>{step.title}</p>
              <p style={{ margin: 0, color: '#666', fontSize: '13px', lineHeight: '1.6' }}>{step.desc}</p>
            </div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #eee', marginTop: '24px', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>Simplify Finance | ACL 387025 | St Leonards, Sydney</p>
        </div>

      </div>
    </div>
  )
}
