"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  onDoorClosed, theDoorHasClosed, cookieSaysOut, LOOK_EVERY_MS,
} from '@/lib/the-door-closed'
import { nowInSydney } from '@/lib/same-date-everywhere'

// YOU HAVE BEEN SIGNED OUT. YOUR WORK IS HERE.
//
// 13 Nov 2026. Katie worked for an hour into a compliance card that had been
// signed out underneath her. Nothing on screen changed. Every box was empty,
// every save went nowhere, and the portal looked completely normal.
//
// Fabio: "the pop-up sign out will show exactly the minute the portal realizes
// that it logged out... with the positive message saying your work is still
// there. Sign in again."
//
// IT ASKS THE BROWSER, IT DOES NOT SIT IN THE WAY. The first version of this
// wrapped every database request so it could watch them leave, and broke the
// whole portal - no deal card would load. This only reads the session the
// browser is already holding. Nothing here can stop a request or slow one down.
//
// NOTHING IS ADDED TO A WORKING SCREEN. It renders nothing at all until the
// moment it matters. The portal is busy enough.
export default function TheDoorClosed() {
  const [shut, setShut] = useState(false)
  const [at, setAt] = useState('')

  // Draw when the door closes, whoever noticed it - the heartbeat's 401, the
  // look below, or coming back to the tab.
  useEffect(() => onDoorClosed(() => {
    setAt(nowInSydney())
    setShut(true)
  }), [])

  useEffect(() => {
    let stopped = false

    // LOCAL. getSession reads the cookie this browser already holds; it does
    // not ask the server anything.
    const look = async () => {
      if (stopped) return
      try {
        const { data } = await supabase.auth.getSession()
        if (cookieSaysOut(data?.session)) theDoorHasClosed()
      } catch {
        // Could not tell is not the same as signed out. Say nothing.
      }
    }

    const timer = setInterval(look, LOOK_EVERY_MS)
    // SOMEBODY COMING BACK FROM LUNCH finds out when they look at the screen,
    // not when they type into it.
    const onShow = () => { if (!document.hidden) look() }
    document.addEventListener('visibilitychange', onShow)
    look()

    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [])

  if (!shut) return null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="You have been signed out"
      data-signed-out="1"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/50 p-4"
    >
      <div className="w-full max-w-[460px] rounded-2xl bg-card p-7 shadow-2xl">
        <p className="mb-2 text-[21px] font-bold text-ink">You have been signed out</p>
        <p className="mb-4 text-sm leading-relaxed text-body">
          This happened just now, at {at}.{' '}
          <strong className="text-ink">Your work is saved on this computer.</strong>{' '}
          Sign in again and it will be offered back to you when you open this deal.
        </p>
        <a
          href="/login"
          className="inline-block rounded-[10px] bg-ink px-5 py-2.5 text-sm font-semibold text-page"
        >
          Sign in again
        </a>
      </div>
    </div>
  )
}
