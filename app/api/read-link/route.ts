import { NextResponse } from 'next/server'
import {
  tidyLink, whyNotALink, isOurOwnSide, kindFromLink, nameFromLink, siteOf,
  pageToText, tooThinToRead, LINK_MAX_BYTES, LINK_TIMEOUT_MS,
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
        // Said plainly. A lender who wants to know who is reading their page
        // should be able to find out from one line in their own logs.
        'user-agent': 'SimplifyFinancePortal/1.0 (lender policy library; one document, on request)',
        accept: 'application/pdf,text/html,text/plain;q=0.9,*/*;q=0.5',
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
      error: res.status === 401 || res.status === 403
        ? 'That page needs a login. Sign in yourself, save the document, and drop the file instead.'
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
    return NextResponse.json({
      kind: 'pdf', url: landed, site: siteOf(landed),
      parts: [{ name, kind: 'pdf', base64: Buffer.from(bytes).toString('base64') }],
      skipped: [],
    })
  }

  const text = pageToText(Buffer.from(bytes).toString('utf8'))
  if (tooThinToRead(text)) {
    return NextResponse.json({
      error: 'There was almost nothing on that page. It may need a login, or the policy may be on a document linked from it.',
    }, { status: 422 })
  }

  return NextResponse.json({
    kind: 'page', url: landed, site: siteOf(landed),
    parts: [{ name, kind: 'text', text }],
    skipped: [],
  })
}
