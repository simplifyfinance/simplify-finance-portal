import { notFound } from 'next/navigation'
import { verifyOpportunity } from '@/lib/opportunity-link'
import { buildPriceOpportunityPage } from '@/lib/price-opportunity-email'
import Notify from './Notify'

// A client-facing page. It sits outside the (app) route group so it carries no
// sidebar or portal chrome, and /opportunity is on the middleware allowlist so a
// reader with no login is never bounced to the sign-in screen.

export const metadata = { title: 'Simplify Finance' }

export default async function OpportunityPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const p = verifyOpportunity(token)
  if (!p) notFound()

  // The same builder the email uses, so the page cannot drift from what was sent.
  const { html } = buildPriceOpportunityPage({ clientFirstName: p.name, brokerName: p.brokerName })

  return (
    <div style={{ background: '#f5f5f3', minHeight: '100vh' }}>
      <Notify token={token} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
