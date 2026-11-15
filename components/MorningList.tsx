'use client'
import Link from 'next/link'
import { useState } from 'react'
import {
  morningList, morningWords, byKind, KIND_HEADING, type MorningItem, type MorningKind,
} from '@/lib/the-morning-list'
import { useSettlementSettings } from '@/lib/use-settlement-settings'

// THE MORNING LIST.
//
// Everything that needs somebody, across every deal, at the top of the screen
// they already open. The spec: "You should not have to open a file to find out
// it has gone quiet."
//
// IT IS NOT A COUNT. Every row names the deal, says what is wanted and how long
// it has been, and goes straight to the file. A number with no names behind it
// is a screen somebody has to go and investigate, which is the thing this
// replaces.
//
// IT FOLDS, AND IT REMEMBERS NOTHING. Open on arrival, because a list that
// starts closed is a list nobody reads. Folded away by hand for the rest of the
// session when somebody has worked through it - not stored, because tomorrow
// morning it should be open again.
//
// ONE COLOUR, AND IT MEANS ONE THING. Simplify blue where a person has to
// decide something. Nothing is red: a lender being slow is not an error.

const TONE: Record<MorningKind, string> = {
  dated: 'text-brand-ink',
  chase: 'text-ink',
  checkin: 'text-muted',
}

function Row({ item }: { item: MorningItem }) {
  return (
    <Link href={`/deals/${item.dealId}`}
      className="flex items-baseline gap-3 border-t border-line-soft px-3 py-2 text-[13px] first:border-0 hover:bg-page">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{item.dealName}</span>
        <span className={`block truncate text-[12.5px] ${TONE[item.kind]}`}>{item.words}</span>
      </span>
      <span className="whitespace-nowrap text-[11.5px] text-faint">{item.since}</span>
    </Link>
  )
}

export default function MorningList({ deals }: { deals: any[] }) {
  const settings = useSettlementSettings()
  const [shut, setShut] = useState(false)

  const items = morningList(deals || [], settings)
  const groups = byKind(items)

  // A QUIET BOOK SAYS SO. "The screen is never blank" - an empty list that
  // draws nothing reads as something that failed to load.
  if (items.length === 0) {
    return (
      <div className="mb-4 rounded-xl border border-line bg-card px-4 py-3">
        <span className="text-[13px] font-semibold text-ink">{morningWords(items)}</span>
        <span className="ml-2 text-[12.5px] text-faint">
          Nothing is past its chase time, nothing falls due today, and no check-in is owed.
        </span>
      </div>
    )
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border-2 border-brand-ink bg-card">
      <button onClick={() => setShut(s => !s)}
        className="flex w-full items-center gap-2.5 border-b border-card-line bg-page px-4 py-2.5 text-left">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">
          This morning
        </span>
        <span className="text-[13px] font-bold text-ink">{morningWords(items)}</span>
        <span className="ml-auto text-[11.5px] text-faint">{shut ? 'show' : 'hide'}</span>
      </button>

      {!shut && (['dated', 'chase', 'checkin'] as MorningKind[]).map(kind => {
        const rows = groups[kind]
        if (rows.length === 0) return null
        return (
          <div key={kind}>
            <div className="flex items-center gap-2 border-b border-line-soft bg-card px-3 pb-1 pt-2.5">
              <span className="text-[10.5px] font-extrabold uppercase tracking-[.07em] text-muted">
                {KIND_HEADING[kind]}
              </span>
              <span className="text-[11px] text-faint">{rows.length}</span>
            </div>
            {rows.map((item, i) => <Row key={`${item.dealId}-${item.kind}-${i}`} item={item} />)}
          </div>
        )
      })}
    </div>
  )
}
