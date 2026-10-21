"use client"
import { useEffect, useRef } from 'react'
import { TOUCH_EVERY_MS } from '@/lib/two-factor'

// SOMEBODY IS ACTUALLY AT THE KEYBOARD.
//
// 21 Oct 2026. Fabio: "I leave the portal open and it stays open overnight."
//
// THIS IS THE PIECE THAT DECIDES WHETHER IDLE MEANS IDLE.
//
// The portal saves as you type and keeps a presence record for every open
// deal. If any request pushed the idle clock, a laptop left open would keep
// itself signed in until morning and the hour would never run out - which is
// the exact thing being fixed. So the clock is pushed by two things only: a
// page a person navigated to, and this.
//
// It listens for a real finger - a key, a mouse button, a touch - and tells the
// server at most once every five minutes. A tab sitting open with nobody at it
// sends nothing and times out, which is the whole point.
//
// WHY NOT mousemove: a cat on a desk, a trackpad nudged by a sleeve, and some
// screen savers all move the pointer. Pressing something is a decision.
export default function StillHere() {
  const last = useRef(0)

  useEffect(() => {
    let stopped = false

    const tell = () => {
      const now = Date.now()
      if (now - last.current < TOUCH_EVERY_MS) return
      last.current = now
      // fire-and-forget: this is a heartbeat. A failed one costs nothing and
      // the next keystroke in five minutes sends another.
      fetch('/api/2fa/touch', { method: 'POST', keepalive: true }).catch(() => {})
    }

    // A HIDDEN TAB IS NOT SOMEBODY WORKING. Without this, a background tab
    // that happens to receive a key event would hold the session open.
    const onKey = () => { if (!stopped && !document.hidden) tell() }

    window.addEventListener('keydown', onKey, { passive: true })
    window.addEventListener('pointerdown', onKey, { passive: true })
    window.addEventListener('touchstart', onKey, { passive: true })

    return () => {
      stopped = true
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onKey)
      window.removeEventListener('touchstart', onKey)
    }
  }, [])

  return null
}
