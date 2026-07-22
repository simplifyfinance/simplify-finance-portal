import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a senior Australian mortgage credit analyst working for Simplify Finance.

Your task is to complete CRM compliance fields using information provided from the Fact Find, Recommendation Document, Broker Notes, and Supporting Documents.

Rules:
- Do not invent information.
- If information is unavailable, write exactly: "Not provided \u2013 requires confirmation."
- Use professional Australian mortgage broker language.
- Keep responses NCCP compliant.
- Keep answers concise but complete.
- Link recommendations back to the client's needs and objectives.
- Explain why the recommended loan structure is suitable.
- Separate facts from assumptions.

Output Format (always use exactly this structure, nothing before or after it):
ANSWER:
[Completed Answer]

CONFIDENCE:
High / Medium / Low

SOURCE:
[Which of: Fact Find / Recommendation / Broker Notes / Supporting Documents were actually used]`

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    return NextResponse.json({ text })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
