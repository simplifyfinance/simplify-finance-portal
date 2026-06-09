import { NextRequest, NextResponse } from 'next/server'

const brokers: Record<string, { name: string; title: string; crn: string }> = {
  'Fabio — Simplify Finance': { name: 'Fabio de Castro', title: 'Director / Mortgage Broker', crn: '483807' },
  'Mark — Simplify Finance': { name: 'Mark Gallo', title: 'Mortgage Broker', crn: '496195' },
}

export async function POST(req: NextRequest) {
  const { prompt, broker } = await req.json()
  const brokerInfo = brokers[broker] || brokers['Fabio — Simplify Finance']

  const systemPrompt = `You are generating a professional HTML email for Simplify Finance, a Sydney-based mortgage broker. Return ONLY raw HTML — no markdown, no code fences, no explanation, no preamble.

EXACT STRUCTURE TO FOLLOW:

1. Outer wrapper: <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f3;padding:20px 0;font-family:Arial,sans-serif">

2. Inner content: max-width 600px, centered, background white.

3. HEADER — background #343333, padding 24px, text-align center:
   - Logo image: <img src="https://simplify-finance-portal.vercel.app/file.svg" alt="Simplify Finance" style="height:40px;margin-bottom:8px">
   - Tagline: "Finance, Simplified." in white, font-size 12px, letter-spacing 2px, text-transform uppercase

4. BODY — padding 32px, background white:
   - Greeting and 2-3 sentence personalised opening paragraph
   - Cream loan structure card: background #F2E8DB, border-radius 8px, padding 16px, margin-bottom 16px
     - Title "Your Loan Structure" in #7a5c3a, font-size 11px, uppercase, letter-spacing 0.5px
     - Each split: bold label, then rate and type on next line in #555
   - Cream assumptions card: same styling
     - Title "Based on Your Numbers"
     - Bullet list of key figures
   - Blue info box: background #EEF6FD, border-left 3px solid #2DBEFF, padding 12px, border-radius 0 6px 6px 0, font-size 12px, color #333
     - Text: "These figures are indicative only and based on the information provided. Final approval is subject to full credit assessment and lender conditions."
   - Next steps paragraph
   - Two CTA buttons side by side: "Book a call" (background #2DBEFF, color white) and "I'm ready to proceed" (background #343333, color white). Both: padding 10px 20px, border-radius 6px, text-decoration none, font-size 13px, font-weight 600, display inline-block

5. BROKER SIGNATURE BOX — border 1px solid #e5e5e5, border-radius 8px, padding 14px 16px, max-width 280px, margin-top 24px (NOT full width):
   - Broker name: font-size 14px, font-weight 600, color #333
   - Title: font-size 12px, color #666
   - "CR No. ${brokerInfo.crn}" font-size 11px, color #999
   - "Simplify Finance" font-size 11px, color #2DBEFF

6. DISCLAIMER — font-size 11px, color #999, margin-top 20px, line-height 1.5:
   "This assessment is indicative only and subject to full credit assessment, lender approval, and verification of all information provided. Interest rates quoted are indicative and may change. This is not a credit approval or commitment to lend."

7. FOOTER — background #343333, padding 16px, text-align center, font-size 11px, color rgba(255,255,255,0.5):
   "© 2026 Simplify Finance | St Leonards, Sydney | Australian Credit Licence: 387025"

BROKER DETAILS TO USE:
Name: ${brokerInfo.name}
Title: ${brokerInfo.title}
CR No: ${brokerInfo.crn}`

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
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  })

  const data = await res.json()
  let html = data.content?.[0]?.text || ''
  html = html.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim()
  return NextResponse.json({ html })
}
