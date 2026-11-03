import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { readPdfFormAnswers, answersAsText } from '@/lib/the-answers-are-in-the-form'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are extracting structured data from an Australian mortgage broker's Fact Find PDF document.

Return ONLY valid JSON, nothing else - no markdown fences, no preamble, no explanation.

Extract into this exact structure:
{
  "applicants": [
    {
      "firstName": "", "middleName": "", "lastName": "", "preferredName": "", "previousName": "",
      "gender": "", "dob": "YYYY-MM-DD or empty string",
      "phoneMobile": "", "emailPersonal": "",
      "addresses": [{ "address": "", "residentialStatus": "Renting/Owner/Boarding/Living with family or empty", "startDate": "YYYY-MM-DD or empty" }],
      "employment": [{ "occupation": "", "employerName": "", "employmentBasis": "Full time/Part time/Casual/Self-employed or empty", "startDate": "YYYY-MM-DD or empty" }],
      "income": [{ "incomeType": "PAYG/Self-employed/Other taxable/Other non-taxable or empty", "grossSalary": "", "grossSalaryFrequency": "Annually/Monthly/Fortnightly/Weekly or empty" }]
    }
  ],
  "dependants": "number of dependants as a plain digit string, e.g. '2', or empty string if not stated",
  "assets": [{ "assetType": "Bank account/Shares/Super/Vehicle or empty", "description": "", "value": "" }],
  "properties": [{
    "address": "", "ownershipType": "Owner occupied/Investment or empty", "value": "", "rentalIncome": "",
    "loans": [{ "lenderName": "", "balance": "", "limitAmount": "", "interestRate": "", "repaymentAmount": "", "repaymentFrequency": "Monthly/Fortnightly/Weekly or empty" }]
  }],
  "liabilities": [{ "liabilityType": "Credit card/Car loan/Personal loan/HECS or empty", "lenderName": "", "limitAmount": "", "balance": "", "repaymentAmount": "", "repaymentFrequency": "Monthly/Fortnightly/Weekly or empty" }]
}

Rules:
- Only include an applicant/asset/property/liability entry if there is genuine evidence of it in the document.
- If a specific field's value cannot be found, use an empty string "" - do not guess or invent values.
- Dates must be YYYY-MM-DD format or empty string if not clearly stated.
- Numbers (income, value, limit, balance) should be plain digit strings with no $ sign or commas, e.g. "85000".
- Return ONLY the JSON object.

THE TYPED ANSWERS ARE GIVEN TO YOU AS TEXT.
The Simplify fact find is a fillable PDF: everything a client types lives in
the form layer, and the page underneath is blank. Those typed answers are
listed for you under "ANSWERS TYPED INTO THE FORM", one per line, exactly as
they were entered.

Use that list as the truth for every value. The field names in it are whatever
a PDF editor left behind - 'undefined_4', 'Since_2', 'fill_62 2' - so they say
nothing on their own about which question an answer belongs to. The pages are
what tell you that: read the form to see where each answer sits, and copy the
value from the list rather than from the picture.

An answer that is in the list is in the document. Do not leave a field empty
because you cannot make out the picture.`

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64 } = await req.json()
    // THE ANSWERS, READ OFF THE FORM LAYER. See lib/the-answers-are-in-the-form.ts
    // for why reading the page was never going to work on this document.
    const answers = await readPdfFormAnswers(pdfBase64)
    const typed = answersAsText(answers)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      // A TWO APPLICANT FACT FIND DOES NOT FIT IN 4,000 TOKENS.
      //
      // 3 Nov 2026. Two people, their addresses, employment and income, the
      // assets, the properties with their loans, and a page of liabilities.
      // Past the cap the answer stops mid-sentence, cannot be read, and the
      // whole upload fails - so a long fact find, which is exactly the one
      // worth importing, was the one most likely to come back with nothing.
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: typed
            ? `ANSWERS TYPED INTO THE FORM\n${typed}\n\nExtract the Fact Find data from this document into the specified JSON structure.`
            : 'Extract the Fact Find data from this document into the specified JSON structure.' }
        ]
      }]
    })

    // A CUT-OFF ANSWER SAYS SO.
    //
    // It used to fail at JSON.parse and come back as "Unexpected end of JSON
    // input", which tells a broker nothing and reads like a broken portal. It
    // is not broken: the fact find was too long for the reply.
    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json({
        error: 'This fact find is longer than the import can return in one go. '
          + 'Nothing has been changed on the deal. Tell Fabio - the limit needs raising.',
      }, { status: 500 })
    }

    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const cleaned = text.replace(/```json|```/g, '').trim()
    let extracted: any
    try {
      extracted = JSON.parse(cleaned)
    } catch {
      // The same rule: say what happened, and say the deal is untouched.
      return NextResponse.json({
        error: 'The fact find was read but the answer came back in a shape the portal could not use. '
          + 'Nothing has been changed on the deal.',
      }, { status: 500 })
    }
    // How many answers were found in the form layer, so the review box can say
    // so - and so a fact find that is a scan rather than a form is obvious.
    return NextResponse.json({ extracted, typedAnswers: answers.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
