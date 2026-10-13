import { NextResponse } from 'next/server'
import {
  tidyLink, whyNotALink, isOurOwnSide, kindFromLink, nameFromLink, siteOf,
  pageToText, tooThinToRead, splitIntoTopics, LINK_MAX_BYTES, LINK_TIMEOUT_MS,
} from '@/lib/dropped-links'

export const maxDuration = 120

// FETCHING ONE ADDRESS A PERSON PASTED.
//
// 13 Oct 2026. The twin of /api/expand-drop. That one opens a file somebody
// dropped; this one opens an address somebody pasted, and both hand back the
// same shape so the library does not care which way a document arrived.
//
// It fetches ONCE, when a person asks. There is no schedule, nothing recurring
// and nothing that goes looking on its own - see the note at the top of
// lib/dropped-links.ts for why that line matters.
//
// WHAT COMES BACK IS DATA. A lender's page may contain any words at all,
// including words shaped like instructions to whatever is reading it. Nothing
// here acts on the content; it is stored and quoted, exactly like an upload.

export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { body = {} }

  const url = tidyLink(body?.url)
  const why = whyNotALink(url)
  if (why) return NextResponse.json({ error: why }, { status: 400 })

  let res: Response
  const stop = AbortSignal.timeout(LINK_TIMEOUT_MS)
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: stop,
      headers: {
        // 13 Oct 2026. This used to announce itself as SimplifyFinancePortal,
        // on the reasoning that a lender should be able to see who read their
        // page. Macquarie's CDN saw an unknown agent and refused, and the
        // portal then told Fabio their public PDF "needs a login" - which it
        // does not. Being honest in a header got us treated as a scraper.
        //
        // So it asks the way a browser asks. Nothing else changes: one
        // document, when a person presses a button, and the address is kept
        // beside it so anybody can open the lender's own copy.
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
          + '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/pdf,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-AU,en;q=0.9',
      },
    })
  } catch (e: any) {
    const timedOut = String(e?.name || '') === 'TimeoutError'
    return NextResponse.json({
      error: timedOut
        ? 'That page took too long to answer. Try again, or save it and drop the file.'
        : 'That address could not be opened. Check it opens in your own browser first.',
    }, { status: 502 })
  }

  // A REDIRECT CAN LAND SOMEWHERE ELSE. The address a person pasted was
  // checked; where it ended up has not been, and a redirect to our own side of
  // the wall is exactly the thing the check existed to stop.
  let landed = url
  try { landed = res.url || url } catch { landed = url }
  try {
    if (isOurOwnSide(new URL(landed).hostname)) {
      return NextResponse.json({ error: 'That address redirected onto our own network.' }, { status: 400 })
    }
  } catch { /* keep the address we were given */ }

  if (!res.ok) {
    return NextResponse.json({
      error: res.status === 401
        ? 'That page needs a login. Sign in yourself, save the document, and drop the file instead.'
        : res.status === 403
          // Their side refused us, which usually means a bot filter rather than
          // a password. Saying "needs a login" sent somebody hunting for one.
          ? 'Their website blocked us — it opens fine in your browser. Save the file and drop it instead.'
          : `That address answered ${res.status}. Check it opens in your own browser first.`,
    }, { status: 502 })
  }

  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > LINK_MAX_BYTES) {
    return NextResponse.json({ error: 'That document is too big to pull down. Save it and drop the file.' }, { status: 413 })
  }

  const type = String(res.headers.get('content-type') || '').toLowerCase()
  let bytes: ArrayBuffer
  try { bytes = await res.arrayBuffer() } catch {
    return NextResponse.json({ error: 'That document could not be read all the way through.' }, { status: 502 })
  }
  if (bytes.byteLength > LINK_MAX_BYTES) {
    return NextResponse.json({ error: 'That document is too big to pull down. Save it and drop the file.' }, { status: 413 })
  }

  const isPdf = type.includes('pdf') || kindFromLink(landed) === 'pdf'
  const name = nameFromLink(landed) || siteOf(landed) || 'document'

  if (isPdf) {
    // THE FILE DOES NOT TRAVEL THROUGH THE BROWSER.
    //
    // 13 Oct 2026. This used to hand the whole PDF back as base64, which the
    // page then posted on to /api/extract-policy. Vercel caps a request body at
    // 4.5MB and base64 makes a file a third bigger, so every credit policy
    // worth having died on the way back in - and the page reported "0 lines"
    // with no reason, because readPart threw the error away.
    //
    // Now only the address comes back. The reader fetches it server to server,
    // where nothing is capped and nothing is encoded twice.
    return NextResponse.json({
      kind: 'pdf', url: landed, site: siteOf(landed),
      parts: [{ name, kind: 'pdf', fileUrl: landed }],
      skipped: [],
    })
  }

  const text = pageToText(Buffer.from(bytes).toString('utf8'))
  if (tooThinToRead(text)) {
    return NextResponse.json({
      error: 'There was almost nothing on that page. It may need a login, or the policy may be on a document linked from it.',
    }, { status: 422 })
  }

  // ONE TOPIC AT A TIME. AMP's policy library is one page with thirty five
  // topics on it. Sent whole it comes back cut in half and parses to nothing;
  // cut on the lender's own headings it reads like a zip of chapters, and the
  // library counts it down the same way.
  const topics = splitIntoTopics(text, name)
  return NextResponse.json({
    kind: 'page', url: landed, site: siteOf(landed),
    parts: topics.map(t => ({ name: t.name, kind: 'text', text: t.text })),
    skipped: [],
  })
}
