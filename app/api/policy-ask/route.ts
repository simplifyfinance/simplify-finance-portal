import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// ASKING THE xAI COLLECTION, FROM INSIDE THE PORTAL.
//
// 15 Oct 2026. A second reader of the same lender policy, built outside this
// codebase and pointed at an xAI Collection. It arrived written to go in at
// app/api/paco/route.ts - which is the portal's own Paco and answers from the
// deal, the team's notes, the policy rules and the sections. Dropping it there
// would have blanked the assistant, so it lives at its own door.
//
// WHICH OF THE TWO ANSWERS A POLICY QUESTION IS NOT DECIDED YET, and until it
// is, nothing in components/Paco.tsx calls this. Two unlabelled answers to one
// question is how a team stops trusting both.

export const maxDuration = 300

const COLLECTION_ID = process.env.PACO_COLLECTION_ID || ''

// THE FLOOR UNDER "NADA", AND IT IS MEASURED RATHER THAN GUESSED.
//
// 15 Oct 2026. Asked "crypto currency as a deposit" against Macquarie - a term
// that appears zero times in that document - the search returned matches
// anyway, off the cover page and the contents, with a top score of 0.00057.
// A real question, "cash out", scored about 0.11. Two hundred times apart.
//
// Without a floor, "Nada" rests entirely on grok-4 looking at the cover page
// and deciding not to answer. Our own search taught us what that costs: the
// word "deposit" matched, the genuine savings section came back, and it read
// as a complete and confident answer to a question about crypto.
//
// 0.01 sits an order of magnitude above the nonsense and an order below the
// real one. Overridable without a deploy, because two measurements is enough
// to act on and not enough to be certain.
const FLOOR = Number(process.env.PACO_SCORE_FLOOR || '0.01')
const XAI_API_KEY = process.env.XAI_API_KEY

// Answer ONLY from the excerpts, and say so plainly when they do not cover it.
// The same rule lib/paco-reads-the-section.ts enforces on our own search, for
// the same reason: a near miss presented as an answer is the most convincing
// kind of wrong there is.
const PARROT_PROMPT = `You are Paco, a credit policy parrot.
Answer ONLY from the provided policy excerpts.
If the information is not in the excerpts, reply exactly: "Nada".
Always quote the relevant wording and cite the lender and source file.
Never mix lenders. Never invent rules.`

export async function POST(req: NextRequest) {
  // 1. SIGNED IN, OR NOTHING.
  //
  // Every other route in this portal starts here. As it arrived, this one
  // answered anybody who found the URL - spending the xAI credits and handing
  // out lenders' credit policy to whoever asked.
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  if (!XAI_API_KEY || !COLLECTION_ID) {
    return NextResponse.json({ error: 'The policy bot is not configured.' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const question = String(body?.question || '').trim()
  const askedFor = String(body?.lender || '').trim()
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

  // 2. THE LENDER IS MATCHED AGAINST OUR OWN LIST, NEVER INTERPOLATED RAW.
  //
  // It arrived as filter = `lender = "${lender}"` with whatever was posted. A
  // name with a quote in it breaks the query, and unvalidated input going into
  // a filter expression is a door left open for no reason. The name that
  // reaches xAI is one of ours or the search is unfiltered.
  let lenderName = ''
  if (askedFor) {
    const { data: row } = await supabase.from('lenders')
      .select('name').ilike('name', askedFor).limit(1).maybeSingle()
    if (!row?.name) {
      return NextResponse.json(
        { error: `There is no lender called "${askedFor}" in the portal.` }, { status: 400 })
    }
    lenderName = String(row.name)
  }

  const searchBody: any = {
    query: question,
    source: { collection_ids: [COLLECTION_ID] },
    retrieval_mode: { type: 'hybrid' },
  }
  // A lender name cannot contain a double quote by the time it gets here - it
  // came out of our own table - but it is escaped anyway, because the next
  // person to touch this will not know that.
  if (lenderName) searchBody.filter = `lender = "${lenderName.replace(/"/g, '\\"')}"`

  try {
    const searchRes = await fetch('https://api.x.ai/v1/documents/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    })
    if (!searchRes.ok) {
      return NextResponse.json(
        { error: 'The policy search did not answer.', details: await searchRes.text() }, { status: 502 })
    }

    const searchData = await searchRes.json()
    const all = Array.isArray(searchData?.matches) ? searchData.matches : []

    // WEAK CONTEXT NEVER REACHES THE MODEL. Not trimmed, not caveated - it does
    // not go. A model handed a cover page and asked a question it cannot answer
    // is a model being invited to be helpful about nothing.
    const chunks = all.filter((c: any) => Number(c?.score) >= FLOOR)
    const best = all.reduce((m: number, c: any) => Math.max(m, Number(c?.score) || 0), 0)

    if (chunks.length === 0) {
      return NextResponse.json({
        answer: '', found: false, lender: lenderName, citations: [],
        // What the best match scored, so the floor can be tuned on real
        // questions instead of on a hunch. Nothing is shown to a broker.
        belowFloor: { best, floor: FLOOR, matches: all.length },
      })
    }

    const context = chunks
      .map((c: any, i: number) => `[${i + 1}] ${String(c?.chunk_content ?? '')}`)
      .join('\n\n')

    const chatRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [
          { role: 'system', content: PARROT_PROMPT },
          { role: 'user', content: `Question: ${question}\n\nPolicy excerpts:\n${context}` },
        ],
        temperature: 0.1,
      }),
    })
    if (!chatRes.ok) {
      return NextResponse.json(
        { error: 'The policy bot did not answer.', details: await chatRes.text() }, { status: 502 })
    }

    const chatData = await chatRes.json()
    const raw = String(chatData?.choices?.[0]?.message?.content || '').trim()

    // 3. "NADA" IS A SIGNAL BETWEEN MACHINES, NOT A SENTENCE FOR A BROKER.
    //
    // `found: false` is what the screen reads. It then says what Paco already
    // says when he has nothing - check with the lender or your BDM, and tell me
    // what they say - rather than a word that looks like something broke.
    const found = raw !== '' && raw.toLowerCase() !== 'nada'

    return NextResponse.json({
      answer: found ? raw : '',
      found,
      lender: lenderName,
      // A CITATION A CREDIT ASSESSOR CAN CHECK.
      //
      // The first version of this returned a file id and 300 characters, which
      // names nothing. The collection carries fields.lender and fields.title,
      // so a citation now reads "Macquarie - macquarie-credit-guidelines.pdf"
      // and the person can open the document.
      //
      // page_number came back as 0 on the test document and may be absent on
      // others, so it is only shown when it is a real page. A citation that
      // says "page 0" is worse than one that says nothing about pages.
      //
      // THERE IS NO SECTION HEADING IN THE RESPONSE. Our own search has one -
      // lib/split-into-sections.ts takes it off the document's own headings -
      // and that is the one thing this citation cannot do yet.
      citations: chunks.map((c: any) => {
        const page = Number(c?.page_number)
        return {
          fileId: String(c?.file_id ?? ''),
          lender: String(c?.fields?.lender ?? ''),
          document: String(c?.fields?.title ?? ''),
          page: Number.isFinite(page) && page > 0 ? page : null,
          score: typeof c?.score === 'number' ? c.score : null,
          quote: String(c?.chunk_content ?? '').slice(0, 300),
        }
      }),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: `The policy bot could not be reached: ${String(e?.message || e)}` }, { status: 502 })
  }
}
