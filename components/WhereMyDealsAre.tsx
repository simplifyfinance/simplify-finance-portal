"use client"
import { useState } from 'react'
import Link from 'next/link'
import { byStage, whoHasIt, stageNote, type StageRow } from '@/lib/the-brokers-monday'
import { phaseSince } from '@/lib/deal-phase'
import { dayMonth } from '@/lib/same-date-everywhere'

// WHERE MY DEALS ARE.
//
// 12 Nov 2026, mocked and approved: "Where my deals are tells him what we are
// doing, including which of our credit team is holding each file. That is the
// thing a self-employed broker cannot see today and rings up to ask."
//
// EVERY LINE ANSWERS "WHO DO I CHASE". It is not a count for its own sake -
// Fabio took exactly that off his own Today a fortnight ago: "Live deals 130,
// fact find 13. It's just a waste of time." A number is only here because
// pressing it shows you the files and who is holding them.
//
// THE STAGES ARE THE PORTAL'S, FOLDED. lib/the-brokers-monday.ts folds the
// thirteen phases into the five a broker thinks in. It does not invent a
// second ladder - see the note there, and the day that cost us.
const CAP = 'text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-muted'

function Opened({ row, officerName }: { row: StageRow; officerName: (id: any) => string }) {
  return (
    <div className="-mt-[3px] mb-[7px] rounded-[10px] border border-line bg-card px-3 pb-2 pt-1">
      {row.deals.slice(0, 6).map(d => {
        const since = phaseSince(d)
        return (
          <div key={d.id}
               className="flex items-center gap-2.5 border-b border-line-soft py-1.5
                          text-[12.5px] last:border-b-0">
            <Link href={`/deals/${d.id}`} className="flex-1 truncate font-semibold hover:underline">
              {d.deal_name}
            </Link>
            {since && <span className="text-[11px] text-faint">since {dayMonth(since)}</span>}
            <span className="whitespace-nowrap rounded-full border border-line bg-page px-2.5
                             py-px text-[10.5px] font-semibold text-muted">
              {whoHasIt(d, officerName)}
            </span>
          </div>
        )
      })}
      {row.deals.length > 6 && (
        <div className="py-1.5 text-[11px] font-semibold text-brand-ink">
          and {row.deals.length - 6} more
        </div>
      )}
    </div>
  )
}

export default function WhereMyDealsAre({ deals, officerName }: {
  deals: any[]
  /** id -> the person's name, so a row can say "Mellissa has it". */
  officerName: (id: any) => string
}) {
  const [open, setOpen] = useState<string | null>(null)
  const rows = byStage(deals)

  if (rows.length === 0) return null

  return (
    <div className="mb-3 rounded-xl border border-card-line bg-card px-4 py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={CAP}>Where my deals are</span>
        <span className="ml-auto text-[11px] text-faint">press a stage to see them</span>
      </div>

      {rows.map(row => (
        <div key={row.stage}>
          <button type="button"
                  onClick={() => setOpen(o => (o === row.stage ? null : row.stage))}
                  aria-expanded={open === row.stage}
                  className="mb-[7px] flex w-full items-center gap-3 rounded-[10px] border
                             border-line-soft bg-page px-3 py-2.5 text-left">
            <span className="w-[34px] flex-none text-center text-[22px] font-extrabold leading-none
                             text-brand-ink">
              {row.count}
            </span>
            <span>
              <span className="block text-[13px] font-bold">{row.stage}</span>
              <span className="block text-[11.5px] text-faint">{stageNote(row, officerName)}</span>
            </span>
            <span aria-hidden className="ml-auto text-[11px] text-faint">
              {open === row.stage ? '▴' : '▾'}
            </span>
          </button>
          {open === row.stage && <Opened row={row} officerName={officerName} />}
        </div>
      ))}
    </div>
  )
}
