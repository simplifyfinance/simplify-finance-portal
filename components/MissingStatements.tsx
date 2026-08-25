'use client'
import { useMemo } from 'react'
import { todayYmd } from '@/lib/periods'
import { TONE } from '@/lib/tone'
import { COMMISSION_START, expectedMonths, issuedOn, stepMonth, type StatementKind } from '@/lib/commission-schedule'
import { brokerKey } from '@/lib/broker-key'

// Names the statements that have been paid but not loaded. It never asks for
// one the aggregator has not issued yet.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const mLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
const KINDS: StatementKind[] = ['upfront', 'trail']

export default function MissingStatements({
  statements, brokers,
}: {
  statements: any[]
  brokers: { key: string; name: string; from: string }[]
}) {
  const { gaps, nextUp } = useMemo(() => {
    const today = todayYmd()
    const have = new Set(statements.map(
      s => `${brokerKey(s.broker_key)}|${s.kind}|${String(s.period_month).slice(0, 7)}`))

    const gaps: { name: string; kind: string; months: string[] }[] = []
    for (const b of brokers) {
      const loaded = statements
        .filter(s => brokerKey(s.broker_key) === b.key)
        .map(s => String(s.period_month).slice(0, 7)).sort()
      if (!b.from && loaded.length === 0) continue        // not earning here yet
      const from = b.from || loaded[0] || COMMISSION_START
      for (const kind of KINDS) {
        const missing = expectedMonths(kind, from, today)
          .filter(m => !have.has(`${b.key}|${kind}|${m}`))
        if (missing.length) gaps.push({ name: b.name.split(' ')[0], kind, months: missing })
      }
    }

    // the soonest statement not yet issued, so the page can say what to expect
    let nextUp: { kind: StatementKind; month: string; on: string } | null = null
    for (const kind of KINDS) {
      const issued = expectedMonths(kind, COMMISSION_START, today)
      const month = issued.length ? stepMonth(issued[issued.length - 1], 1) : COMMISSION_START
      const on = issuedOn(kind, month)
      if (!nextUp || on < nextUp.on) nextUp = { kind, month, on }
    }
    return { gaps, nextUp }
  }, [statements, brokers])

  const due = nextUp
    ? `Next is ${nextUp.kind} for ${mLabel(nextUp.month)}, paid ${Number(nextUp.on.slice(8))} ${MONTHS[Number(nextUp.on.slice(5, 7)) - 1]}.`
    : ''

  if (gaps.length === 0) {
    return (
      <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px] border"
           style={{ background: TONE.accentSoft, borderColor: TONE.accentLine, color: '#0B6F9E' }}>
        <b>Every statement that has been paid is loaded.</b> {due}
      </div>
    )
  }

  const total = gaps.reduce((t, g) => t + g.months.length, 0)

  return (
    <div className="rounded-xl px-4 py-3.5 mb-5 text-[12.5px] border"
         style={{ background: TONE.accentSoft, borderColor: TONE.accentLine, color: '#0B6F9E' }}>
      <div className="font-semibold mb-1.5" style={{ color: '#095B83' }}>
        {total} {total === 1 ? 'statement has' : 'statements have'} been paid but not loaded
      </div>
      <div className="grid gap-[3px]">
        {gaps.map(g => (
          <div key={g.name + g.kind}>
            <b style={{ color: '#095B83' }}>{g.name} {g.kind}</b>{' — '}{g.months.map(mLabel).join(', ')}
          </div>
        ))}
      </div>
      <div className="mt-2" style={{ color: '#2E7FA8' }}>
        Upfront is paid on the 26th of the following month, trail on the 16th two months on — nothing above is
        asked for before that. {due}
      </div>
    </div>
  )
}
