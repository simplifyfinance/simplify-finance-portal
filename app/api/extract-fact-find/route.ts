import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
      "income": [{ "incomeType": "Base salary/Rental/Other or empty", "grossSalary": "", "grossSalaryFrequency": "Annually/Monthly/Fortnightly/Weekly or empty" }]
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
- Return ONLY the JSON object.`

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64 } = await req.json()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: 'Extract the Fact Find data from this document into the specified JSON structure.' }
        ]
      }]
    })
    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const cleaned = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(cleaned)
    return NextResponse.json({ extracted })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
