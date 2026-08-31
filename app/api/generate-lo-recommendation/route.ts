import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { prompt, styleNotes } = await req.json()
    // Corrections the team has flagged before, promoted in Settings. Same idea as
    // the Compliance generator: feedback is only worth giving if it changes the
    // next draft.
    const styleBlock = (styleNotes && styleNotes.length > 0)
      ? `\n\nAdditional style notes from previous broker feedback — follow these consistently:\n${styleNotes.map((n: string) => `- ${n}`).join('\n')}`
      : ''
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt + styleBlock }]
    })
    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    return NextResponse.json({ text })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
