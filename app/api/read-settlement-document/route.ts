import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// THE OTHER TWO SETTLEMENT DOCUMENTS.
//
// 17 Nov 2026. The loan contract has its own route because it returns a list of
// loans and nothing else does. These two return one object each, so they share
// a route and differ only in the list of fields asked for.
//
// THE FILE IS NOT KEPT, exactly as with the contract. Fabio: "we dont need to
// store the documents after reading but obviously we retain all data." It
// arrives, it is read, and it is gone when this returns.
//
// The rule at the top of both prompts is the same rule the fact find, the
// payslip, the lender policy and the loan contract routes all carry: do not
// guess. A missing value is useful. A wrong one is dangerous.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DO_NOT_GUESS = `Return ONLY valid JSON, nothing else - no markdown fences, no preamble, no explanation.

DO NOT GUESS OR INVENT ANY VALUE. If the document does not state something, use an empty string. A missing value is useful; a wrong one is dangerous.
Copy what is written exactly. Do not reformat dates, do not convert anything, do not calculate anything.`

const SIGNED = `You are reading a SIGNED set of Australian home loan documents returned by a borrower to their broker.

${DO_NOT_GUESS}

{
  "signedBy": ["full name of each person who has signed, exactly as written beside their signature"],
  "signaturesDated": "'yes' if every signature on the document carries a date, 'no' if any signature has no date beside it, or empty string if you cannot tell",
  "directDebit": "the account nominated for loan repayments - BSB and account number, or the account name, as written. Empty string if no account is nominated",
  "repaymentFrequency": "exactly one of: Weekly, Fortnightly, Monthly, or empty string if no frequency is ticked or written",
  "offsetAccount": "the offset account nominated, as written. Empty string if none is nominated"
}

Notes:
- A name PRINTED on a form is not a signature. Only list a person in signedBy where the document shows they have signed.
- A direct debit form left blank is an empty string, not the lender's name.
- Return ONLY the JSON object.`

const INSURANCE = `You are reading an Australian certificate of currency for building insurance, or a strata/body corporate insurance certificate.

${DO_NOT_GUESS}

{
  "insurer": "the insurance company's name, or empty string",
  "policyNumber": "the policy number as written, or empty string",
  "insured": "the full address of the property the policy covers, or empty string",
  "interestedParty": "who is noted as the interested party, mortgagee, financial interest or noted party - exactly as written. Empty string if nobody is noted",
  "expires": "the date cover ends, as written on the document, e.g. '4 August 2027'. If a period of cover is given, this is the END of that period. Empty string if not stated",
  "kind": "exactly one of: Building, Strata, or empty string if the document does not make it clear"
}

Notes:
- The interested party is often a bank. If the box exists but is blank, return an empty string - do not fill it with the insured's name.
- The START of the period of cover is NOT the expiry. Return the end date.
- The sum insured is not asked for. Do not return it.
- Return ONLY the JSON object.`

const PROMPTS: Record<string, string> = { signed: SIGNED, insurance: INSURANCE }

const WORD: Record<string, string> = {
  signed: 'signed loan documents',
  insurance: 'insurance certificate',
}

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, kind } = await req.json()
    const system = PROMPTS[String(kind || '')]
    if (!system) {
      return NextResponse.json({ error: 'That is not a document this reader knows about.' }, { status: 400 })
    }
    if (!pdfBase64) {
      return NextResponse.json({ error: 'No document was received.' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      // A SIGNED PACK IS LONG AND THE ANSWER IS SHORT. 2000 is generous for
      // five fields, and the stop_reason is still checked - a truncated answer
      // that parses is the dangerous kind.
      max_tokens: 2000,
      system,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: 'Read this document into the specified JSON structure.' },
        ],
      }],
    })

    const noun = WORD[String(kind)] || 'document'

    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json({
        error: `The ${noun} is longer than the reader can return in one go. `
          + 'Nothing has been recorded. Tell Fabio - the limit needs raising.',
      }, { status: 500 })
    }

    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const cleaned = text.replace(/```json|```/g, '').trim()
    let read: any
    try {
      read = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({
        error: `The ${noun} could not be read. Nothing has been recorded against the deal.`,
      }, { status: 500 })
    }

    return NextResponse.json({ read })
  } catch (e: any) {
    return NextResponse.json({
      error: `The document could not be read - ${e?.message || 'unknown error'}. Nothing has been recorded.`,
    }, { status: 500 })
  }
}
