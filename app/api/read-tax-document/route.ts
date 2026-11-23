import { NextRequest, NextResponse } from 'next/server'
import { documentFrom, ReadingRoomError } from '@/lib/the-reading-room'
import Anthropic from '@anthropic-ai/sdk'
import { onlyStaff } from '@/lib/only-staff'

// READING A TAX RETURN, A SET OF FINANCIALS, OR WHATEVER ELSE LANDED.
//
// 22 Nov 2026. Fabio: "I want a similar way that we extract pay slips. I want
// to do that for self-employed... I want the system to summarize tax returns,
// the income, net profit, depreciation, any interest, if there is a
// depreciation schedule."
//
// THE FIRST JOB IS SAYING WHAT THE DOCUMENT IS. Everything after that depends
// on it: a trust return stops the simple route, a second company stops it, and
// an individual return and a set of financials are read for completely
// different things. So this classifies before it extracts, and it is allowed
// to answer "unknown" - which puts the file in front of a person rather than
// into a figure.
//
// IT DOES NOT DECIDE WHETHER THE DEAL CAN BE DONE. That is lib/tax-documents.ts,
// off the documents this returns. One file reads paper; another applies rules.
//
// NO ADD-BACK IS APPLIED HERE EITHER. This returns what the document says.
// Whether depreciation is added back, whether interest is, and whether a
// director's wage would be counted twice are judgements - they belong to the
// person, on the screen, with a tick. See the note in lib/se-comparison.ts.
//
// SIZE IS NOT A PROBLEM ANY MORE. A full set of financials with two years and
// a depreciation schedule runs well past what Vercel will take in a request
// body, so this takes the document through the reading room like the loan
// contracts do. See lib/the-reading-room.ts.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are reading an Australian tax document for a mortgage broker assessing a self-employed borrower's income.

Return ONLY valid JSON, nothing else - no markdown fences, no preamble, no explanation.

FIRST decide what the document is. One of:
  "individual_return"    an individual income tax return (ATO individual tax return)
  "company_return"       a company tax return (ATO Form C)
  "company_financials"   financial statements for a company - profit and loss, balance sheet. These usually show TWO financial years side by side.
  "trust_return"         a trust tax return
  "partnership_return"   a partnership tax return
  "notice_of_assessment" an ATO notice of assessment
  "unknown"              anything else, including a payslip, a bank statement, or a document you cannot identify

{
  "kind": "",
  "entityName": "the person or company the document belongs to, exactly as written",
  "abn": "the ABN as digits only, no spaces, or empty string",
  "years": [
    {
      "fy": "the financial year in the form 2024/25. An Australian financial year ends 30 June, so a document for the year ended 30 June 2025 is '2024/25'",
      "salary": "",
      "netProfit": "",
      "depreciation": "",
      "interest": "",
      "superannuation": "",
      "oneOff": "",
      "other": ""
    }
  ]
}

What goes in each figure, as a plain digit string with no $ or commas, or an empty string if the document does not state it:
- salary: on an INDIVIDUAL return, salary or wages. On financials or a company return, leave empty.
- netProfit: on FINANCIALS or a COMPANY return, the net profit or loss BEFORE tax. On an individual return, net income or loss from business.
- depreciation: depreciation and amortisation expense.
- interest: interest expense paid by the business.
- superannuation: superannuation expense, where it is stated separately.
- oneOff: an expense the document itself describes as one-off, non-recurring or extraordinary.
- other: any other expense the document itself labels as added back.

Rules:
- DO NOT GUESS OR INVENT ANY VALUE. An empty string is useful; a wrong figure is dangerous.
- If the document covers two financial years, return one entry per year. Financial statements almost always do.
- Copy figures exactly as stated. Do not round, do not convert, do not calculate anything.
- A loss is a negative number, with a minus sign.
- DO NOT add anything back. Return what the document says. Somebody else decides what is added back.
- If you cannot tell which financial year a column belongs to, leave fy empty rather than guessing.
- Return ONLY the JSON object.`

const txt = (v: any) => String(v ?? '').trim()
const digits = (v: any) => txt(v).replace(/[^0-9.\-]/g, '')

const KINDS = ['individual_return', 'company_return', 'company_financials',
  'trust_return', 'partnership_return', 'notice_of_assessment', 'unknown']

export async function POST(req: NextRequest) {
  // ONLY AN ACTIVE STAFF MEMBER. See lib/only-staff.ts and
  // docs/the-security-audit.md - 23 Nov 2026.
  const { refusal } = await onlyStaff()
  if (refusal) return refusal
  try {
    const body = await req.json()
    const fileName = txt(body?.fileName).slice(0, 200)
    const pdfBase64 = await documentFrom(body)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      // TWO YEARS OF FINANCIALS IS NOT A SHORT ANSWER, and the document most
      // worth reading is the longest one. Same lesson as the loan contracts.
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: 'Say what this document is, then read it into the specified JSON structure.' },
        ],
      }],
    })

    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json({
        error: 'This document is longer than the reader can return in one go. '
          + 'Nothing has been recorded. Tell Fabio - the limit needs raising.',
      }, { status: 500 })
    }

    const out = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    let read: any
    try {
      read = JSON.parse(out.replace(/```json|```/g, '').trim())
    } catch {
      return NextResponse.json({
        error: 'That document could not be read. Nothing has been recorded against the deal.',
      }, { status: 500 })
    }

    // ANYTHING THAT IS NOT ONE OF THE SEVEN IS UNKNOWN, not a new kind nobody
    // downstream has heard of. lib/tax-documents.ts decides what each kind
    // means, and it must never be handed a word it does not know.
    const kind = KINDS.includes(txt(read?.kind)) ? txt(read.kind) : 'unknown'

    const years = (Array.isArray(read?.years) ? read.years : []).slice(0, 4).map((y: any) => ({
      // A YEAR IT COULD NOT TELL IS LEFT EMPTY, and the screen asks. A guessed
      // financial year is a figure quoted against the wrong year, which is the
      // one mistake on this screen that nobody would catch by eye.
      fy: /^\d{4}\/\d{2}$/.test(txt(y?.fy)) ? txt(y.fy) : '',
      salary: digits(y?.salary),
      netProfit: digits(y?.netProfit),
      depreciation: digits(y?.depreciation),
      interest: digits(y?.interest),
      superannuation: digits(y?.superannuation),
      oneOff: digits(y?.oneOff),
      other: digits(y?.other),
    }))

    return NextResponse.json({
      fileName,
      kind,
      entityName: txt(read?.entityName).slice(0, 200),
      abn: digits(read?.abn).replace(/\./g, '').slice(0, 11),
      years,
    })
  } catch (e: any) {
    if (e instanceof ReadingRoomError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json({
      error: `That document could not be read - ${e?.message || 'unknown error'}. Nothing has been recorded.`,
    }, { status: 500 })
  }
}
