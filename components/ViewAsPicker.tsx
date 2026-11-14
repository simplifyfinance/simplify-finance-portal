"use client"
import { useState } from 'react'
import Link from 'next/link'
import { grouped, SEAT_WORD, type Somebody } from '@/lib/view-as'

// THE PICKER, AND IT IS ONLY ON ONE ACCOUNT.
//
// 12 Nov 2026. Fabio: "I cant see credit and broker how do I know what it
// looks like" and "the view as I dont want everyone to have it just me."
//
// The page decides whether to draw this at all - see lib/view-as.ts. By the
// time it renders, the question of who may look has already been answered.
//
// IT IS A LINK, NOT A FORM. Each choice is a plain href, so the browser's back
// button works, the address can be shared with me when something looks wrong,
// and nothing about the picker needs state on the server.
export default function ViewAsPicker({ people, meName }: {
  people: Somebody[]
  meName: string
}) {
  const [open, setOpen] = useState(false)
  const groups = grouped(people)

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-card
                   px-[11px] py-1.5 text-[12.5px] font-semibold text-ink"
      >
        <span className="font-medium text-faint">Viewing as</span>
        {meName || 'Myself'}
        <span aria-hidden className="text-[10px] text-faint">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-[250px] overflow-hidden rounded-[10px]
                     border border-line bg-card shadow-[0_8px_22px_rgba(0,0,0,.12)]"
        >
          <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-b border-line-soft bg-info-bg px-3 py-2
                       text-[12.5px] font-bold text-brand-ink">
            Myself
            <span className="ml-auto text-[10px] font-normal text-faint">your own Today</span>
          </Link>

          {groups.map(g => (
            <div key={g.group}>
              <div className="border-b border-line-soft bg-page px-3 pb-1 pt-2 text-[9px]
                              font-extrabold uppercase tracking-[0.1em] text-faint">
                {g.group}
              </div>
              {g.people.map(p => (
                <Link key={p.id} href={`/dashboard?as=${p.id}`} role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 border-b border-line-soft px-3 py-2
                             text-[12.5px] last:border-b-0 hover:bg-page">
                  {p.name}
                  <span className="ml-auto text-[10px] text-faint">{SEAT_WORD[p.seat]}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
