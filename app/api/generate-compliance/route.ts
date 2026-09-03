import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a senior Australian mortgage credit analyst working for Simplify Finance.

You are given the facts of one deal, read live from the fact find, the borrowing
capacity workings and the lending options. Write the CRM compliance field asked for,
using those facts and nothing else.

THE RULE THAT MATTERS MORE THAN ANY OTHER — never invent.

- Every number, name, date and fact in your answer must appear in the facts you were
  given. Do not calculate a figure that was not supplied. Do not estimate. Do not
  reach for what is typical, usual or likely for a client like this.
- The facts end with a list headed NOT RECORDED. Anything on that list is genuinely
  unknown. Say so in one short sentence — "The number of dependants has not been
  recorded" — and move on. Never write around a gap, and never fill one.
- If a field asks you to discuss something you were not given, say plainly that it
  is not recorded. That is a correct and complete answer.

LENGTH — short and true beats long and padded.

- There is no minimum length. Say what the facts support and stop.
- A three-sentence answer built entirely on recorded facts is better than three
  paragraphs where two are filler. Do not pad, do not restate the question, do not
  add a closing summary that repeats what you just wrote.
- Never use a sentence that would read the same on any deal.

HOW TO WRITE

- Plain English, addressed to a credit assessor who will check every figure.
- Use the client's actual figures and name them.
- Where a loan is split for different purposes, treat each part as what it is. An
  owner-occupied refinance with an equity release for investment is two purposes,
  not one loan.
- Australian spelling. Refer to applicants by name; use plural forms only when there
  really is more than one applicant.

OUTPUT FORMAT — exactly this, nothing before or after:

ANSWER:
[the field text]

CONFIDENCE:
High / Medium / Low

SOURCE:
[List only what you actually used, from: Fact Find / Borrowing capacity / Lending
options / Broker notes. If you had to say something was not recorded, say so here
too.]`

export async function POST(req: NextRequest) {
  try {
    const { prompt, styleNotes, facts } = await req.json()
    const styleBlock = (styleNotes && styleNotes.length > 0)
      ? `\n\nAdditional style notes from previous broker feedback — follow these consistently:\n${styleNotes.map((n: string) => `- ${n}`).join('\n')}`
      : ''
    // THE FACTS OF THE DEAL, read live from the fact find and passed in whole.
    // Before this, the route received a sentence with seven numbers in it and was
    // asked for five hundred words - so everything past those seven numbers had
    // to be invented. See lib/deal-facts.ts.
    const content = facts
      ? `THE FACTS OF THIS DEAL\n\n${facts}\n\n---\n\nTHE FIELD TO WRITE\n\n${prompt}`
      : prompt

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      // Zero, on purpose. Unset means 1.0, which is why the same deal written
      // twice came back materially different both times. Fabio, 3 Sep 2026: the
      // notes "are not consistent".
      temperature: 0,
      system: SYSTEM_PROMPT + styleBlock,
      messages: [{ role: 'user', content }]
    })
    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    return NextResponse.json({ text })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
