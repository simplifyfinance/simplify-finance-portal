import { NextResponse } from 'next/server'
import { pdfToText } from '@/lib/pdf-to-text'
import { tidyLink, whyNotALink, isOurOwnSide } from '@/lib/dropped-links'

export const maxDuration = 300

// THE WORDS, AND NOTHING ELSE.
//
// 13 Oct 2026. This route exists because of an ordering mistake that cost a
// day. Everything the library knew about a document used to come out of one
// model call that carved it into hundreds of rules. When that call ran out of
// room the reply came back as truncated JSON, nothing parsed, and the
// document - uploaded, hashed, complete, sitting in the bucket - was invisible
// to Paco. Fabio pressed the button four times and got "0 lines" every time.
//
// So getting the words out is now its own step, and it is the FIRST one:
//
//   1. the words are stored, and that is what "filed" means
//   2. splitting into sections may be retried
//   3. reading rules out of it may be retried
//
// Nothing here calls a model. No key, no prompt, no JSON to parse. It either
// reads the file or it says why it could not, and either way the answer is the
// same every time it is asked.

const BROWSER = {
  // Being honest in a header got us treated as a scraper - see the note in
  // app/api/read-link/route.ts. We ask the way a browser asks.
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  accept: 'application/pdf,text/plain,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
}

// "%PDF" at the front. A file dropped as base64 is not necessarily a PDF - the
// NAB chapters arrived as markdown - and decoding a markdown file through a PDF
// reader produces nothing with no explanation.
const looksLikePdf = (b: Buffer): boolean =>
  b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    // ALREADY TEXT. A pasted document, a web page, a markdown chapter. Nothing
    // to do but hand it back, and this is the common case.
    const plain = String(body?.text || '')
    if (plain.trim()) {
      return NextResponse.json({
        text: plain, chars: plain.length, pages: 0, cutShort: false, how: 'it was already text',
      })
    }

    let bytes: Buffer | null = null

    const base64 = String(body?.base64 || '')
    if (base64) {
      try { bytes = Buffer.from(base64, 'base64') } catch {
        return NextResponse.json({ error: 'That file could not be decoded.' }, { status: 400 })
      }
    }

    // A PDF ON A LENDER'S WEBSITE IS FETCHED HERE, server to server, because
    // Vercel caps a request body at 4.5MB and base64 makes a file a third
    // bigger. Every credit policy worth having exceeds that.
    const fileUrl = tidyLink(body?.fileUrl)
    if (!bytes && fileUrl) {
      const why = whyNotALink(fileUrl)
      if (why) return NextResponse.json({ error: why }, { status: 400 })
      try {
        const got = await fetch(fileUrl, {
          redirect: 'follow', signal: AbortSignal.timeout(60_000), headers: BROWSER,
        })
        if (!got.ok) {
          return NextResponse.json({
            error: got.status === 403
              ? 'Their website blocked us — it opens fine in your browser. Save the file and drop it instead.'
              : `Their website answered ${got.status} when we went for the document.`,
          }, { status: 502 })
        }
        // Checked again on where it LANDED, not just where it was pointed.
        if (isOurOwnSide(new URL(got.url || fileUrl).hostname)) {
          return NextResponse.json({ error: 'That address redirected onto our own network.' }, { status: 400 })
        }
        bytes = Buffer.from(await got.arrayBuffer())
      } catch {
        return NextResponse.json({ error: 'That document could not be fetched.' }, { status: 502 })
      }
    }

    if (!bytes || bytes.length === 0) {
      return NextResponse.json({ error: 'No document was sent.' }, { status: 400 })
    }

    // A PDF GETS ITS LINES REBUILT. Anything else is read as plain text, which
    // is right for markdown, csv and txt and harmless for anything that turns
    // out not to be readable - it comes back as very little, and "very little"
    // is reported rather than hidden.
    if (looksLikePdf(bytes)) {
      try {
        const got = await pdfToText(bytes)
        if (!got.text.trim()) {
          return NextResponse.json({
            error: 'That PDF has no text in it — it is probably a scan. It needs to be run through OCR first.',
          }, { status: 422 })
        }
        return NextResponse.json({
          text: got.text, chars: got.text.length, pages: got.pages,
          cutShort: got.cutShort,
          how: `read ${got.read} of ${got.pages} page${got.pages === 1 ? '' : 's'}`,
        })
      } catch (e: any) {
        return NextResponse.json({
          error: `That PDF could not be opened — ${String(e?.message || e).slice(0, 200)}`,
        }, { status: 422 })
      }
    }

    const text = bytes.toString('utf8')
    if (!text.trim()) {
      return NextResponse.json({ error: 'There were no words in that file.' }, { status: 422 })
    }
    return NextResponse.json({
      text, chars: text.length, pages: 0, cutShort: false, how: 'read as plain text',
    })
  } catch (e: any) {
    // SAID, NOT SWALLOWED. The whole reason this route is separate is so a
    // failure here is distinguishable from a failure anywhere else.
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 })
  }
}
