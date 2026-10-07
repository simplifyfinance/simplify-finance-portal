'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { onBusyChange, isBusy, navArrived } from '@/components/useBusy'

// THE BAR ACROSS THE TOP. Fabio picked it on 7 Oct, alongside the skeletons.
//
// It is three pixels of brand blue that creeps from the left and disappears
// when the page is ready, and it is the same thing GitHub and YouTube do for
// the same reason: movement at the top edge is caught by the corner of your eye
// without you looking for it, which a grey word in the content never is.
//
// WHY IT CREEPS RATHER THAN FILLS. Nothing here knows how far along a fetch is,
// and a bar that claims 60% when it has no idea is a lie that gets found out
// every time a page is slow. This one eases towards the right and never reaches
// it, which reads as "still going" rather than "nearly there".
//
// WHY IT STARTS LEFT OF THE SIDEBAR'S EDGE. The left column is the one fixed
// thing on screen and nothing animates over it. w-56 is 224px; if the sidebar
// is ever a different width this moves with it.
//
// IT IS NEVER THE ONLY ANSWER. The bar says a click landed. It does not say the
// page is going to be worth waiting for - that is the skeleton's job. See
// components/Skeleton.tsx.
export default function TopProgress() {
  const [on, setOn] = useState(false)
  const path = usePathname()

  useEffect(() => onBusyChange(() => setOn(isBusy())), [])

  // ARRIVED. The address changing is the only honest sign that the thing the
  // person clicked is now on screen. The pane's own fetch keeps the bar going
  // after this, through useBusyWhile, so handing over here loses nothing.
  useEffect(() => { navArrived() }, [path])

  // The panes under Settings and the Lender library are hash-driven, so for
  // those the hash is the address.
  useEffect(() => {
    const read = () => navArrived()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  if (!on) return null
  return (
    <div className="fixed top-0 left-56 right-0 h-[3px] z-50 pointer-events-none" aria-hidden="true">
      <div className="h-full bg-brand rounded-r-full creep" />
    </div>
  )
}
