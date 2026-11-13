"use client"
import { useEffect } from 'react'
import { someoneIsHere, SIGNS_OF_LIFE } from '@/lib/still-here'

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
//
// 13 NOV 2026 - TYPING INTO A BOX COUNTS TOO, and so does a save. This was too
// strict: Katie saved a compliance card at 3:11pm and the portal signed her
// out at 3:14pm for inactivity. The throttle and the hidden-tab rule are
// unchanged, so a laptop left open overnight still times out. The whole rule
// now lives in lib/still-here.ts, because a save has to be able to say it too.
export default function StillHere() {
  useEffect(() => {
    let stopped = false
    // ONE COUNTER FOR THE WHOLE TAB, in lib/still-here.ts, shared with every
    // save. Typing and saving at the same moment is one person, so it is one
    // heartbeat - not two.
    const tell = () => { if (!stopped) someoneIsHere() }

    for (const e of SIGNS_OF_LIFE) window.addEventListener(e, tell, { passive: true })
    return () => {
      stopped = true
      for (const e of SIGNS_OF_LIFE) window.removeEventListener(e, tell)
    }
  }, [])

  return null
}
