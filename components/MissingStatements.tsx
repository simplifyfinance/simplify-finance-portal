'use client'
import { useMemo } from 'react'
import { todayYmd } from '@/lib/periods'
import { TONE } from '@/lib/tone'

// Says plainly which statements are not loaded, per broker and per type.
// A month is only expected once it has finished and the aggregator has had a
// month to issue it, so the current month is never demanded.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const mLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

function stepMonth(m: string, by: number): string {
  let y = Number(m.slice(0, 4)), n = Number(m.slice(5, 7)) + by
  while (n > 12) { n -= 12; y += 1 }
  while (n < 1) { n += 12; y -= 1 }
  return `${y}-${String(n).padStart(2, '0')}`
}

export default function MissingStatements({
  statements, brokers,
}: {
  statements: any[]
  brokers: { key: string; name: string; from: string }[]
}) {
  const gaps = useMemo(() => {
    const have = new Set(statements.map(
      s => `${String(s.broker_key).toLowerCase()}|${s.kind}|${String(s.period_month).slice(0, 7)}`))
    // the last month a statement could reasonably exist for
    const end = stepMonth(todayYmd().slice(0, 7), -1)

    const out: { name: string; kind: string; months: string[] }[] = []
    for (const b of brokers) {
      const loaded = statements
        .filter(s => String(s.broker_key).toLowerCase() === b.key)
        .map(s => String(s.period_month).slice(0, 7)).sort()
      if (!b.from && loaded.length === 0) continue          // broker not earning here yet
      const start = b.from || loaded[0]
      if (!start || start > end) continue
      for (const kind of ['trail', 'upfront']) {
        const missing: string[] = []
        for (let m = start; m <= end; m = stepMonth(m, 1)) {
          if (!have.has(`${b.key}|${kind}|${m}`)) missing.push(m)
        }
        if (missing.length) out.push({ name: b.name.split(' ')[0], kind, months: missing })
      }
    }
    return out
  }, [statements, brokers])

  if (gaps.length === 0) {
    return (
      <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px] border"
           style={{ background: '#F1F7F3', borderColor: '#CFE6D5', color: '#25794C' }}>
        <b>Every statement is loaded.</b> Nothing is missing up to last month.
      </div>
    )
  }

  const total = gaps.reduce((t, g) => t + g.months.length, 0)

  return (
    <div className="rounded-xl px-4 py-3.5 mb-5 text-[12.5px] border"
         style={{ background: '#FDF6E7', borderColor: '#EFE0BC', color: '#7A5F17' }}>
      <div className="font-semibold mb-1.5" style={{ color: '#5E4A11' }}>
        {total} {total === 1 ? 'statement is' : 'statements are'} not loaded
      </div>
      <div className="grid gap-[3px]">
        {gaps.map(g => (
          <div key={g.name + g.kind}>
            <b style={{ color: '#5E4A11' }}>{g.name} {g.kind}</b>
            {' — '}{g.months.map(mLabel).join(', ')}
          </div>
        ))}
      </div>
      <div className="mt-2" style={{ color: '#8A6E22' }}>
        Drop them above. Until then the trail book counts silence only across months you have loaded, so a gap
        here never reads as a loan that stopped paying.
      </div>
    </div>
  )
}
