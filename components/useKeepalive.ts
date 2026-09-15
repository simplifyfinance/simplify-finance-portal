'use client'
import { useEffect, useRef } from 'react'
import { buildPatch } from '@/lib/keepalive-patch'
import type { Ownership } from '@/lib/field-ownership'

// ONE LAST WRITE AS THE PAGE GOES.
//
// 15 Sep 2026. The autosave waits 600ms after the last keystroke. Hit refresh,
// close the tab or click through to another page inside that window and the
// sentence goes with it - the box looked perfect the whole time, and the last
// line is not there when the deal is opened again.
//
// The four forms already write when a box is left, when the tab is changed and
// when the window is hidden. None of that survives the page being torn down:
// the request goes out and dies with the page that made it.
//
// keepalive is the one thing that does survive. The browser promises to finish
// delivering the request even after the page is gone, so this is the only shape
// of save that works in that moment.
//
// IT SENDS A PATCH, NOT THE RECORD. Only the free typing boxes with something
// unsaved in them, each carrying what this screen last saw saved in it. Nobody
// is watching this write and nobody can be asked to resolve a collision, so it
// is not allowed to win one - see lib/keepalive-patch.ts.

export function useKeepalive({ dealId, column, own, current }: {
  dealId: string
  column: 'bc_data' | 'fact_find_data' | 'lo_data' | 'compliance_data'
  own: Ownership
  // What is on screen right now, including anything half typed.
  current: () => any
}) {
  // Read through a ref so the handler registered at mount always asks the form
  // as it is NOW, not as it was when the page drew.
  const latest = useRef({ own, current })
  latest.current = { own, current }

  useEffect(() => {
    const send = () => {
      let patch: Record<string, any> = {}
      try { patch = buildPatch(latest.current.own, latest.current.current()) } catch { return }
      if (Object.keys(patch).length === 0) return
      const body = JSON.stringify({ dealId, column, patch })
      try {
        // keepalive: the browser finishes this after the page has gone.
        void fetch('/api/deal-keepalive', {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      } catch {
        // Older browsers, or a fetch refused during unload. sendBeacon is the
        // same promise with a worse API, and it sends the session cookie too.
        try { navigator.sendBeacon?.('/api/deal-keepalive', new Blob([body], { type: 'application/json' })) } catch {}
      }
    }

    // pagehide covers refresh, closing the tab and navigating away, including
    // the back/forward cache on Safari where unload never fires at all.
    const onHide = () => { if (document.visibilityState === 'hidden') send() }
    window.addEventListener('pagehide', send)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', send)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [dealId, column])
}
