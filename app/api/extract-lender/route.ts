import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = `You are extracting home loan product information from an Australian lender document.

Extract ALL products you find. For each product return a JSON object with exactly these fields:
- product_name: string
- rate_type: "variable" | "fixed" | "both"
- loan_purpose: "oo" | "investment" | "both"
- application_fee: string or null
- annual_fee: string or null
- valuation_fee: string or null
- rate_lock_fee: string or null
- offset_account: boolean
- multiple_offsets: boolean
- notes: string
- lender_name: string

Return ONLY a valid JSON array starting with [ and ending with ]. No markdown, no backticks, no explanation.`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const url = formData.get('url') as string | null

    if (!file && !url) {
      return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 })
    }

    let messageContent: any[]

    if (file) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      messageContent = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        },
        {
          type: 'text',
          text: EXTRACTION_PROMPT,
        },
      ]
    } else {
      const urlRes = await fetch(url as string)
      const contentType = urlRes.headers.get('content-type') || ''
      if (contentType.includes('pdf') || (url as string).endsWith('.pdf')) {
        const buffer = await urlRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        messageContent = [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          { type: 'text', text: EXTRACTION_PROMPT },
        ]
      } else {
        const html = await urlRes.text()
        messageContent = [
          {
            type: 'text',
            text: `Here is the page content:\n\n${html.slice(0, 20000)}\n\n${EXTRACTION_PROMPT}`,
          },
        ]
      }
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    console.log('AI RAW RESPONSE:', text.substring(0, 500))
    console.log('STOP REASON:', response.stop_reason)

    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    
    if (start === -1 || end === -1) {
      console.log('FULL RESPONSE:', text)
      return NextResponse.json({ error: `No JSON array found. AI said: ${text.substring(0, 200)}` }, { status: 500 })
    }

    const jsonStr = text.slice(start, end + 1)
    const products = JSON.parse(jsonStr)

    return NextResponse.json({ products })
  } catch (err: any) {
    console.error('extract-lender error:', err)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
