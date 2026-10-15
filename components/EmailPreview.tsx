'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// WHAT THE CLIENT WILL ACTUALLY SEE, AT ITS FULL LENGTH.
//
// 15 Oct 2026. Fabio, with both previews open side by side: "LO preview is NOT
// matching BC preview, see BC goes all the way down, LO moves within a box".
//
// He was right, and nobody had decided it. The two were built at different
// times and never compared:
//
//   LO   <iframe srcDoc={emailHtml} className="w-full h-[800px]" />
//   BC   <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
//
// A fixed 800px frame against an email that is twice that, so one scrolled
// inside a box and the other ran down the page.
//
// ---------------------------------------------------------------------------
// WHY THE IFRAME STAYS, AND THE DIV IS THE ONE THAT IS WRONG
// ---------------------------------------------------------------------------
//
// The obvious fix was to make the LO preview a div like the BC one. It is the
// wrong way round. Inside an iframe the email's own CSS is sealed off from the
// portal's; dropped into a div it is rendered THROUGH Tailwind's base styles,
// so the preview is no longer a promise about what arrives in the inbox. It
// has looked close enough so far. "Close enough" is not a thing to rely on for
// an email carrying rates and repayments, which somebody approves by looking
// at it.
//
// So the frame stays and learns to measure itself. Faithful rendering AND full
// length down the page, which is what was wanted in the first place.

export default function EmailPreview({
  html, title, minHeight = 360,
}: { html: string; title: string; minHeight?: number }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(minHeight)

  const measure = useCallback(() => {
    const doc = ref.current?.contentDocument
    const body = doc?.body
    if (!body) return
    // scrollHeight on BOTH, because which one carries the real height depends
    // on whether the email sets a height on html or body - and these emails
    // are table layouts written for Outlook, which do all sorts of things.
    const tall = Math.max(body.scrollHeight, doc?.documentElement?.scrollHeight || 0)
    // A couple of pixels of difference is a rounding artefact, and reacting to
    // it would set state on every measure forever.
    if (tall > 0) setHeight(prev => (Math.abs(prev - tall) > 2 ? tall : prev))
  }, [])

  useEffect(() => {
    const frame = ref.current
    if (!frame) return

    measure()

    // IMAGES AND WEB FONTS ARRIVE AFTER THE FIRST MEASURE, and every one of
    // them makes the email taller. Measured once on load, the frame would be
    // short by exactly the height of the logo.
    const doc = frame.contentDocument
    let watcher: ResizeObserver | null = null
    if (doc?.body && typeof ResizeObserver !== 'undefined') {
      watcher = new ResizeObserver(() => measure())
      watcher.observe(doc.body)
    }

    // The belt to the ResizeObserver's braces: an older browser, or a document
    // that swaps its own content in. Three cheap re-measures and then stop,
    // rather than a timer that runs for as long as the page is open.
    const timers = [120, 500, 1500].map(ms => window.setTimeout(measure, ms))

    return () => {
      watcher?.disconnect()
      for (const t of timers) window.clearTimeout(t)
    }
  }, [html, measure])

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      title={title}
      onLoad={measure}
      // scrolling="no" is deprecated and still the only thing some browsers
      // listen to. The height makes it unnecessary; this stops a scrollbar
      // flickering in for the moment before the first measure lands.
      scrolling="no"
      // `block` matters: an iframe is inline by default and picks up a few
      // pixels of line-height underneath it, which reads as a crooked edge
      // inside the card.
      className="w-full block border-0"
      style={{ height }}
    />
  )
}
