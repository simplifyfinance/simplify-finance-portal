import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { prompt, broker } = await req.json()

  const brokers: Record<string, { name: string; title: string; crn: string }> = {
    'Fabio': { name: 'Fabio de Castro', title: 'Director / Mortgage Broker', crn: '483807' },
    'Mark': { name: 'Mark Gallo', title: 'Mortgage Broker', crn: '496195' },
    'Fabio — Simplify Finance': { name: 'Fabio de Castro', title: 'Director / Mortgage Broker', crn: '483807' },
    'Mark — Simplify Finance': { name: 'Mark Gallo', title: 'Mortgage Broker', crn: '496195' },
  }
  const b = brokers[broker] || brokers['Fabio']

  const systemPrompt = `You are generating a professional HTML borrowing capacity email for Simplify Finance. Return ONLY raw HTML — no markdown, no code fences, no preamble.

STRUCTURE (follow exactly):

1. Outer wrapper: <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f3;font-family:Arial,sans-serif;padding:20px 0">
   Inner content: max-width 600px, centered, background white.

2. HEADER — background #343333, padding 24px, text-align center:
   <img src="/sf-logo-white.png" alt="Simplify Finance" style="height:44px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto">
   Tagline: "Finance, Simplified." — white, font-size 11px, letter-spacing 2px, text-transform uppercase, margin 0

3. AI NOTES BOX (shown before email body — this is for the broker, not the client):
   Background #FFF8E7, border-left 4px solid #F59E0B, border-radius 0 8px 8px 0, padding 14px 16px, margin 16px
   Title: "✦ AI Deal Notes" — font-size 11px font-weight 600 color #92400E uppercase letter-spacing 0.5px margin-bottom 8px
   Content: 2-3 concise dot points observing key aspects of this deal — serviceability considerations, LVR risk, notable liabilities, anything a broker should be aware of when personalising the email. Font-size 12px color #78350F line-height 1.6
   Note at bottom: "📝 Add your personalised opening paragraph above before sending." — font-size 11px color #B45309 font-style italic

4. EMAIL BODY — padding 28px background white:
   - Opening paragraph placeholder: "[Broker to personalise — e.g. 'Hi [Name], great speaking with you today. Based on our conversation...']" — shown in light gray italic font-size 13px color #9CA3AF border 1px dashed #E5E7EB padding 12px border-radius 6px margin-bottom 16px
   - Then: "We have completed your borrowing capacity assessment. Here is a summary of what is possible based on your current financial position."

5. LOAN STRUCTURE CARD — background #F2E8DB, border-radius 8px, padding 16px, margin-bottom 16px:
   Title "Your Loan Structure" — font-size 11px font-weight 600 color #7a5c3a uppercase letter-spacing 0.5px margin-bottom 10px
   Each split on its own row: bold label left, rate + type right. Font-size 13px.

6. ASSUMPTIONS CARD — same cream styling:
   Title "Based on Your Numbers" — same title style
   Bullet list of key figures. Font-size 13px color #555.

7. BLUE INFO BOX — background #EEF6FD, border-left 3px solid #2DBEFF, padding 12px 14px, border-radius 0 6px 6px 0, font-size 12px color #333, margin-bottom 16px:
   "These figures are indicative only and based on the information provided. Final approval is subject to full credit assessment and lender conditions."

8. NEXT STEPS paragraph — font-size 14px color #333, margin-bottom 20px.

9. TWO CTA BUTTONS side by side — margin-bottom 24px:
   "Book a call" — background #2DBEFF color white padding 10px 20px border-radius 6px font-size 13px font-weight 600 text-decoration none display inline-block margin-right 8px
   "I'm ready to proceed" — background #343333 color white same styling

10. BROKER SIGNATURE BOX — border 1px solid #e5e5e5, border-radius 8px, padding 14px 16px, max-width 260px (NOT full width):
    ${b.name} — font-size 14px font-weight 600 color #333 margin-bottom 2px
    ${b.title} — font-size 12px color #666 margin-bottom 2px
    CR No. ${b.crn} — font-size 11px color #999

11. DISCLAIMER — font-size 11px color #999 margin-top 20px line-height 1.6:
    "This assessment is indicative only and subject to full credit assessment, lender approval, and verification of all information provided. Interest rates quoted are indicative and may change. This is not a credit approval or commitment to lend."

12. FOOTER — background #343333, padding 16px, text-align center, font-size 11px, color rgba(255,255,255,0.5):
    "© 2026 Simplify Finance | St Leonards, Sydney | Australian Credit Licence: 387025"

IMPORTANT: The AI notes box content should be genuinely useful broker observations based on the deal data provided.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  let html = data.content?.[0]?.text || ''
  html = html.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim()
  return NextResponse.json({ html })
}
