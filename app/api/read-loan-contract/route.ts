import { NextRequest, NextResponse } from 'next/server'
import { documentFrom, ReadingRoomError } from '@/lib/the-reading-room'
import Anthropic from '@anthropic-ai/sdk'

// READING A LOAN CONTRACT.
//
// 17 Nov 2026. Fabio, on the settlements team's biggest job: "the biggest task
// we have in our team is to make sure the rates is correct, the security is
// correct, the terms is correct, if it's interest only, if it's principal and
// interest. So you need to start reading contracts."
//
// THE FILE IS NOT KEPT. Fabio, asked straight: "when I say throw away as we
// dont need to store the documents after reading but obviously we retain all
// data." So the PDF arrives, is read, and is gone when this returns. What it
// said is written onto the deal with who dropped it and when.
//
// SEVERAL AT ONCE. A split loan has a contract per split and the team is
// checking all of them, so this returns a list and the caller matches them up.
//
// It follows the four extraction routes this portal already has - fact find,
// lender, policy, payslip. Same model, same strict JSON, same rule at the top
// of the prompt: do not guess.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are reading an Australian home loan contract (a loan schedule, loan offer or credit contract) issued by a lender to a borrower.

Return ONLY valid JSON, nothing else - no markdown fences, no preamble, no explanation.

A loan contract often covers SEVERAL loans, called splits, accounts or facilities. Return one entry per loan.

{
  "lender": "",
  "reference": "application or contract reference, or empty string",
  "loans": [
    {
      "label": "what the document calls this loan - 'Split 1', 'Loan Account 2', the account number, or empty string",
      "amount": "the loan amount as a plain digit string, no $ or commas, e.g. '340600'",
      "rate": "the interest rate as a plain number string, e.g. '6.14'. No % sign",
      "repayment": "exactly one of: Principal and interest, Interest only, or empty string",
      "ioTerm": "how long the loan is interest only for, as written, e.g. '5 years' or '60 months'. Empty string unless the loan is interest only",
      "loanTerm": "the total loan term as written, e.g. '30 years' or '360 months'",
      "security": "the address of the property securing this loan, or empty string",
      "borrowers": ["full name of each borrower exactly as the contract writes it"]
    }
  ]
}

Rules:
- DO NOT GUESS OR INVENT ANY VALUE. If the contract does not state something, use an empty string. A missing value is useful; a wrong one is dangerous.
- Copy figures exactly as the contract states them. Do not convert years to months or months to years. Do not round a rate.
- Do not calculate anything. If the contract states a monthly repayment, that is not the interest rate.
- Do not merge two loans into one, and do not split one loan into two.
- A comparison rate is NOT the interest rate. If both appear, return the interest rate.
- Return ONLY the JSON object.`

export async function POST(req: NextRequest) {
  try {
    // THE DOCUMENT, HOWEVER IT ARRIVED - 22 Nov 2026.
    //
    // Small files still come as base64 in the body. One too big for Vercel's
    // 4.5 MB request body comes as a path into the reading room, and
    // documentFrom() picks it up and DELETES it before this line returns. See
    // lib/the-reading-room.ts and docs/the-reading-room.sql.
    const pdfBase64 = await documentFrom(await req.json())
    if (!pdfBase64) {
      return NextResponse.json({ error: 'No document was received.' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      // A CONTRACT PACK COVERING FOUR SPLITS IS NOT SHORT. The fact find route
      // learned this the hard way in November: past the cap the answer stops
      // mid-sentence, cannot be parsed, and the longest document - which is the
      // one most worth checking - is the one that fails.
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: 'Read this loan contract into the specified JSON structure. Return one entry per loan.' },
        ],
      }],
    })

    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json({
        error: 'This contract is longer than the reader can return in one go. '
          + 'Nothing has been recorded. Tell Fabio - the limit needs raising.',
      }, { status: 500 })
    }

    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const cleaned = text.replace(/```json|```/g, '').trim()
    let read: any
    try {
      read = JSON.parse(cleaned)
    } catch {
      // IT SAYS WHAT HAPPENED. "Unexpected end of JSON input" tells a
      // settlements officer nothing and reads like a broken portal.
      return NextResponse.json({
        error: 'The contract could not be read. Nothing has been recorded against the deal.',
      }, { status: 500 })
    }

    const loans = Array.isArray(read?.loans) ? read.loans : []
    return NextResponse.json({
      lender: String(read?.lender || ''),
      reference: String(read?.reference || ''),
      loans,
    })
  } catch (e: any) {
    // A DOCUMENT THAT NEVER ARRIVED SAYS SO IN ITS OWN WORDS, and says it as a
    // 400 rather than a 500 - it is not a failure of the reader. 22 Nov 2026.
    if (e instanceof ReadingRoomError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json({
      error: `The contract could not be read - ${e?.message || 'unknown error'}. Nothing has been recorded.`,
    }, { status: 500 })
  }
}
