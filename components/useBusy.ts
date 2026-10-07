'use client'
import { useEffect } from 'react'

// IS THE PORTAL DOING SOMETHING RIGHT NOW.
//
// 7 Oct 2026. Fabio: "when i'm clicking on something like for example RBA
// update and it's loading the page, it just sits there. You don't know if it's
// loading or not."
//
// He is right, and the reason is that every screen answered this question on
// its own and all of them answered it quietly. RateNoticeSettings drew the word
// "Loading" in small grey type at the top left of an otherwise empty page. On a
// wide monitor your eye is nowhere near that corner, so the page reads as
// broken rather than busy - and a person who thinks nothing happened clicks
// again, which loads the whole thing twice.
//
// TWO DIFFERENT QUESTIONS, AND THEY NEED DIFFERENT ANSWERS.
//
//   "did my click land?"          - answered in the first 100ms, by movement
//                                   somewhere your eye already is. That is the
//                                   bar across the top, and it has to work on
//                                   every page at once.
//   "is this going to be a page?" - answered by the page drawing its own shape
//                                   in grey while the figures are on their way.
//                                   That is components/Skeleton.tsx, and it
//                                   goes in one page at a time.
//
// THIS FILE IS THE FIRST ONE. A plain module-level count rather than a React
// context, because a context needs a provider around everything that might ever
// report busy, and that is the whole app - one more wrapper for a boolean.
//
// TWO SOURCES, ONE ANSWER.
//
//   navPending - a nav item was pressed and the page it points at has not
//                arrived yet. Cleared when the address actually changes, so a
//                click that goes nowhere cannot leave the bar running forever.
//   dataCount  - how many screens are currently fetching. A count, not a flag,
//                because two panes can load at once and the first one to finish
//                must not switch the bar off while the second is still going.

type Listener = () => void

let navPending = false
let dataCount = 0
const listeners = new Set<Listener>()

function announce() { listeners.forEach(f => f()) }

export function onBusyChange(f: Listener) {
  listeners.add(f)
  return () => { listeners.delete(f) }
}

export function isBusy() { return navPending || dataCount > 0 }

// Pressed. Said by the sidebar the instant a nav item is clicked, before
// anything has been fetched, because that is the half-second the complaint is
// about.
export function navStarted() {
  if (navPending) return
  navPending = true
  announce()
}

// Arrived. Said by TopProgress when the address changes - never by the thing
// that started it, which cannot know whether the page it asked for turned up.
export function navArrived() {
  if (!navPending) return
  navPending = false
  announce()
}

// A SCREEN SAYS WHEN IT IS FETCHING, AND STOPS SAYING IT WHEN IT UNMOUNTS.
//
// The cleanup matters more than it looks. A pane that is swapped out mid-fetch
// - press RBA rate notice, change your mind, press Products & policy - would
// otherwise leave its count behind and the bar would run until the next reload.
export function useBusyWhile(loading: boolean) {
  useEffect(() => {
    if (!loading) return
    dataCount++
    announce()
    return () => {
      dataCount = Math.max(0, dataCount - 1)
      announce()
    }
  }, [loading])
}
