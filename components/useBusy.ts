'use client'
import { useEffect } from 'react'

// IS THE PORTAL DOING SOMETHING RIGHT NOW.
//
// 7 Oct 2026. Fabio: "when i'm clicking on something like for example RBA
// update and it's loading the page, it just sits there. You don't know if it's
// loading or not."
//
// Every screen answered that on its own and all of them answered it quietly -
// the word "Loading" in small grey type at the top left of an empty page. On a
// wide monitor your eye is nowhere near that corner, so the page reads as
// broken rather than busy, and somebody who thinks nothing happened clicks
// again and loads the whole thing twice.
//
// TWO QUESTIONS, TWO ANSWERS. "Did my click land" is answered in the first
// 100ms by movement where your eye already is - the bar at the top and the ring
// on the mark. "Is this going to be a page" is answered by the page drawing its
// own shape in grey; see components/Skeleton.tsx.
//
// A plain module-level count rather than a React context, because a context
// needs a provider around everything that might ever report busy - which is the
// whole app, for one boolean.
//
// =========================================================== 7 Oct, later
//
// AND IT COUNTS HOW MUCH OF THE WORK IS DONE.
//
// Fabio, on the first version: "the blue line at the top really loads in
// progression to how much you're loading in the table. So it literally goes
// progressively, not just goes at the end, goes at the end."
//
// He is right that a bar which restarts is worse than no bar. The first one ran
// its animation on a loop, so it crept to the right and snapped back to the
// left for as long as the page was busy - movement that says nothing and will
// not let your eye settle.
//
// So the episode is counted. From the moment the bar appears until the moment
// everything is finished, `started` is how many screens have said they are
// fetching and `done` is how many have finished. One screen gives you nothing
// useful; a page firing five queries genuinely steps forward as each lands. The
// bar takes the higher of that fraction and its own creep, and NEVER goes
// backwards - see components/TopProgress.tsx.

type Listener = () => void

let navPending = false
let dataCount = 0

// Counted per episode - from the bar appearing to everything being finished -
// and reset only when the portal is completely idle again. Resetting any
// earlier would be the restart we are trying to get rid of.
let started = 0
let done = 0

const listeners = new Set<Listener>()

function announce() { listeners.forEach(f => f()) }

function resetIfIdle() {
  if (!navPending && dataCount === 0) { started = 0; done = 0 }
}

export function onBusyChange(f: Listener) {
  listeners.add(f)
  return () => { listeners.delete(f) }
}

export function isBusy() { return navPending || dataCount > 0 }

// How much of this episode's work has landed, 0 to 1. Nothing registered yet
// reads as 0 rather than as finished, so the bar creeps instead of completing.
export function busyProgress() { return started > 0 ? done / started : 0 }

// Pressed. Said by the sidebar the instant a nav item is clicked, before
// anything has been fetched, because that is the half-second the complaint was
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
  resetIfIdle()
  announce()
}

// A SCREEN SAYS WHEN IT IS FETCHING, AND STOPS SAYING IT WHEN IT UNMOUNTS.
//
// The cleanup matters more than it looks. A pane swapped out mid-fetch - press
// RBA rate notice, change your mind, press Products & policy - would otherwise
// leave its count behind and the bar would run until the next full reload.
export function useBusyWhile(loading: boolean) {
  useEffect(() => {
    if (!loading) return
    dataCount++
    started++
    announce()
    return () => {
      dataCount = Math.max(0, dataCount - 1)
      done++
      resetIfIdle()
      announce()
    }
  }, [loading])
}
