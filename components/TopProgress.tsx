'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { onBusyChange, isBusy, busyProgress, navArrived } from '@/components/useBusy'

// THE BAR ACROSS THE TOP. IT ONLY EVER GOES FORWARD.
//
// 7 Oct 2026, second attempt. The first one ran a CSS animation on a loop:
// it crept to the right, snapped back to the left and crept again, for as long
// as the page was busy. Fabio: "it keeps loading back and forth, back and
// forth, which is very troubling ... it's very distracting."
//
// A bar that restarts is worse than no bar. It is movement that carries no
// information, and the eye cannot stop watching it.
//
// SO THE WIDTH IS A NUMBER THAT NEVER DECREASES, and it comes from two places:
//
//   the work      - busyProgress() is how many of this episode's fetches have
//                   landed. On a page firing five queries the bar genuinely
//                   steps as each one lands. This is the honest half.
//   a slow creep  - because one query gives you 0 then 1 and nothing in
//                   between, and a bar that sits at zero for two seconds looks
//                   as broken as no bar at all. Each tick closes a fifth of the
//                   remaining distance, so it decelerates and approaches 90
//                   without ever claiming to be finished.
//
// It takes whichever is further along, and it is clamped against its own
// previous value, so no arrangement of the two can walk it backwards.
//
// NINETY, NOT A HUNDRED. Nothing here knows how long a query will take, so the
// bar must not reach the end until the work actually has. It finishes in one
// short movement to 100 and fades, which is the only part of this the eye
// should read as "done".

const CREEP_CEILING = 90
const TICK_MS = 240

export default function TopProgress() {
  const [pct, setPct] = useState(0)
  const [showing, setShowing] = useState(false)
  const path = usePathname()
  const leaveTimer = useRef<any>(null)

  // Busy or not, and the completion that follows it. Kept in one effect so the
  // bar cannot be told to leave and to start again in the same tick.
  useEffect(() => onBusyChange(() => {
    if (isBusy()) {
      if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null }
      setShowing(true)
      setPct(p => (p > 0 ? p : 8))
    } else {
      setPct(p => (p > 0 ? 100 : 0))
      if (!leaveTimer.current) {
        leaveTimer.current = setTimeout(() => {
          leaveTimer.current = null
          setShowing(false)
          setPct(0)
        }, 420)
      }
    }
  }), [])

  // The creep, and the work, whichever is further. Only while actually busy -
  // once it is completing, nothing may move it but the completion.
  useEffect(() => {
    if (!showing) return
    const t = setInterval(() => {
      if (!isBusy()) return
      setPct(p => {
        const crept = p + (CREEP_CEILING - p) / 5
        const worked = busyProgress() * CREEP_CEILING
        return Math.min(CREEP_CEILING, Math.max(p, crept, worked))
      })
    }, TICK_MS)
    return () => clearInterval(t)
  }, [showing])

  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current) }, [])

  // ARRIVED. The address changing is the only honest sign that the thing which
  // was clicked is now on screen. The pane's own fetch keeps the bar going
  // after this, through useBusyWhile, so handing over here loses nothing.
  useEffect(() => { navArrived() }, [path])

  // The panes under Settings and the Lender library are hash-driven, so for
  // those the hash is the address.
  useEffect(() => {
    const read = () => navArrived()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  if (!showing) return null
  return (
    // Left of the sidebar's edge: the left column is the one fixed thing on
    // screen and nothing animates over it. w-56 is 224px.
    <div className="fixed top-0 left-56 right-0 h-[3px] z-50 pointer-events-none" aria-hidden="true">
      <div
        className="h-full bg-brand rounded-r-full"
        style={{
          width: pct + '%',
          opacity: pct >= 100 ? 0 : 1,
          // Long enough to read as movement, short enough that a fast page is
          // not held up by its own progress bar.
          transition: 'width .32s cubic-bezier(.25,.8,.3,1), opacity .26s ease-in .14s',
        }}
      />
    </div>
  )
}
