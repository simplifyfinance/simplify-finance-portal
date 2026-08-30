'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { todayYmd } from '@/lib/periods'
import { TONE } from '@/lib/tone'
import { COMMISSION_START, expectedMonths, issuedOn, stepMonth, type StatementKind } from '@/lib/commission-schedule'
import { brokerKey } from '@/lib/broker-key'

// Names the statements that have been paid but not loaded. It never asks for
// one the aggregator has not issued yet.
//
// A month can also have no statement because there was nothing to pay — a
// broker with no settlements gets no upfront statement at all, so there is
// nothing to upload and the reminder would never go away. Those months are
// marked as issued-nothing and recorded, rather than left on the list or
// quietly hidden.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const mLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
const KINDS: StatementKind[] = ['upfront', 'trail']

export default function MissingStatements({
  statements, brokers,
}: {
  statements: any[]
  brokers: { key: string; name: string; from: string }[]
}) {
  const supabase = createSupabaseBrowser()
  const [none, setNone] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  async function loadNone() {
    const { data, error } = await supabase.from('commission_statement_none')
      .select('broker_key, kind, period_month')
    if (error) { setErr('Could not read which months had nothing issued.'); return }
    setNone(new Set((data || []).map((r: any) =>
      `${brokerKey(r.broker_key)}|${r.kind}|${String(r.period_month).slice(0, 7)}`)))
  }
  useEffect(() => { loadNone() }, [])

  // Postgres reports no error when a policy blocks a write, so the row written
  // back is what proves it saved.
  async function markNone(bKey: string, kind: string, month: string) {
    const id = `${bKey}|${kind}|${month}`
    setBusy(id); setErr('')
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('commission_statement_none')
      .upsert({ broker_key: bKey, kind, period_month: `${month}-01`, marked_by: u?.user?.id || null },
              { onConflict: 'broker_key,kind,period_month' }).select()
    if (error || !data?.length) {
      setErr(error?.message || 'Nothing was saved.')
    } else {
      await loadNone()
    }
    setBusy('')
  }

  const { gaps, nextUp, silenced } = useMemo(() => {
    const today = todayYmd()
    const have = new Set(statements.map(
      s => `${brokerKey(s.broker_key)}|${s.kind}|${String(s.period_month).slice(0, 7)}`))

    const gaps: { name: string; key: string; kind: string; months: string[] }[] = []
    let silenced = 0
    for (const b of brokers) {
      const loaded = statements
        .filter(s => brokerKey(s.broker_key) === b.key)
        .map(s => String(s.period_month).slice(0, 7)).sort()
      if (!b.from && loaded.length === 0) continue        // not earning here yet
      const from = b.from || loaded[0] || COMMISSION_START
      for (const kind of KINDS) {
        const all = expectedMonths(kind, from, today)
          .filter(m => !have.has(`${b.key}|${kind}|${m}`))
        const missing = all.filter(m => !none.has(`${b.key}|${kind}|${m}`))
        silenced += all.length - missing.length
        if (missing.length) gaps.push({ name: b.name.split(' ')[0], key: b.key, kind, months: missing })
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
    return { gaps, nextUp, silenced }
  }, [statements, brokers, none])

  const due = nextUp
    ? `Next is ${nextUp.kind} for ${mLabel(nextUp.month)}, paid ${Number(nextUp.on.slice(8))} ${MONTHS[Number(nextUp.on.slice(5, 7)) - 1]}.`
    : ''

  const silencedNote = silenced > 0
    ? ` ${silenced} month${silenced === 1 ? '' : 's'} marked as nothing issued.`
    : ''

  if (gaps.length === 0) {
    return (
      <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px] border"
           style={{ background: TONE.accentSoft, borderColor: TONE.accentLine, color: '#0B6F9E' }}>
        <b>Every statement that has been paid is loaded.</b> {due}{silencedNote}
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
      <div className="grid gap-[5px]">
        {gaps.map(g => (
          <div key={g.name + g.kind} className="flex items-baseline gap-1.5 flex-wrap">
            <b style={{ color: '#095B83' }}>{g.name} {g.kind}</b>
            {/* Each month is its own button: a broker can be genuinely missing
                one statement and have had nothing to pay in another. */}
            {g.months.map(m => (
              <button key={m} onClick={() => markNone(g.key, g.kind, m)}
                      disabled={busy === `${g.key}|${g.kind}|${m}`}
                      title="SFG issued nothing for this month — stop asking for it"
                      className="rounded-md border px-1.5 py-[1px] bg-white disabled:opacity-40"
                      style={{ borderColor: TONE.accentLine, color: '#0B6F9E' }}>
                {mLabel(m)}
              </button>
            ))}
          </div>
        ))}
      </div>
      {err && <div className="mt-2" style={{ color: TONE.neg }}>{err}</div>}
      <div className="mt-2" style={{ color: '#2E7FA8' }}>
        Upfront is paid on the 26th of the following month, trail on the 16th two months on — nothing above is
        asked for before that. Click a month to record that SFG issued nothing for it, which is what happens when
        a broker had no settlements — it then stops being chased. {due}{silencedNote}
      </div>
    </div>
  )
}
