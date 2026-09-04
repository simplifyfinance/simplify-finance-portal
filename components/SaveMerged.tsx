'use client'
import { useEffect } from 'react'

// SOMETHING CHANGED ON YOUR SCREEN AND YOU DID NOT DO IT.
//
// When two people are on the same tab and their fields do not collide, both
// lots of work are saved and the other person's fields appear here. That is the
// right outcome - but a screen that rewrites itself with no explanation is its
// own kind of bug, and on a fact find it is the kind that makes somebody doubt
// what they are reading.
//
// So it says so, in the house blue rather than a warning colour, because nothing
// has gone wrong. It goes away by itself.
export default function SaveMerged({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, 15000)
    return () => clearTimeout(t)
  }, [message])

  if (!message) return null
  return (
    <div className="border border-[#2DBEFF] bg-[#2DBEFF]/8 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
      <p className="m-0 flex-1 text-[12.5px] leading-[1.6] text-[#0B5C7A]">{message}</p>
      <button onClick={onDismiss} aria-label="Dismiss"
        className="text-[#0B5C7A]/60 hover:text-[#0B5C7A] text-lg leading-none px-1 -mt-0.5">
        ×
      </button>
    </div>
  )
}
