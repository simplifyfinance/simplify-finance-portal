'use client'
import { useEffect, useState } from 'react'
import { BUILD, CHECK_MS, VERSION_URL, isNewer } from '@/lib/new-version'

// NEW VERSION READY - THE LINE IN THE SIDEBAR.
//
// docs/approved-looks/one-new-version.html, layout C, which Fabio picked on
// 6 Oct 2026: under his name, out of the way of the deal, always visible.
//
// WHY IT NEVER RELOADS BY ITSELF. Somebody mid-sentence in a fact find would
// lose the sentence. It waits for the click, every time.
//
// AND WHAT THE CLICK DOES FIRST. Every box in this portal saves when it loses
// focus, so the button takes the focus off whatever is being typed in, waits
// for that save to land, and only then reloads. Anything still unsaved after
// that is already covered by the draft that survives a dead tab - see
// components/InternalNotes.tsx.
export default function NewVersion() {
  const [ready, setReady] = useState(false)
  const [going, setGoing] = useState(false)

  useEffect(() => {
    if (BUILD === 'dev') return   // nothing is deployed on a laptop
    let alive = true

    const ask = async () => {
      if (!alive || document.hidden) return
      try {
        const r = await fetch(VERSION_URL, { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (alive && isNewer(BUILD, j?.build)) setReady(true)
      } catch {
        // Offline, or the network said no. Not knowing is not a new version.
      }
    }

    ask()
    const timer = setInterval(ask, CHECK_MS)
    // Coming back to a tab that has been sitting all morning is exactly when
    // the answer has changed, so ask then too rather than waiting out the cycle.
    const look = () => { if (!document.hidden) ask() }
    document.addEventListener('visibilitychange', look)
    window.addEventListener('focus', look)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', look)
      window.removeEventListener('focus', look)
    }
  }, [])

  if (!ready) return null

  const reload = () => {
    setGoing(true)
    const typing = document.activeElement as HTMLElement | null
    try { typing?.blur() } catch { /* nothing was focused */ }
    // Long enough for the save that the blur started to reach the database.
    window.setTimeout(() => window.location.reload(), 1400)
  }

  return (
    <div className="flex items-center gap-2 mb-3 rounded-[9px] px-2.5 py-2
      bg-brand/[.14] border border-brand/30">
      <span aria-hidden className="w-[7px] h-[7px] rounded-full bg-brand flex-none" />
      <span className="text-[11px] font-[650] text-brand whitespace-nowrap">
        {going ? 'Reloading…' : 'New version'}
      </span>
      <button onClick={reload} disabled={going}
        aria-label="Reload to get the new version"
        className="ml-auto text-[10.5px] font-[650] text-on-brand bg-brand
          rounded-md px-2.5 py-[3px] disabled:opacity-60">
        Reload
      </button>
    </div>
  )
}
