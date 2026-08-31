'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { TONE, money } from '@/lib/tone'
import { sameBroker } from '@/lib/broker-key'
import RowLimit, { STEPS } from '@/components/RowLimit'
import { downloadCsv, stamp } from '@/lib/csv'

// Trail that stopped arriving. Two kinds, and they are not the same thing:
//
//   Came back  — the loan resumed paying, which proves the payment was owed
//                and simply did not arrive. This is money to chase.
//   Still away — nothing since. Under three months it may yet return; beyond
//                that the Gone list treats it as lost, because the loan has
//                most likely discharged and no one owes anything.
const GONE_AFTER = 3
const DEFAULT_TO = 'commissions@spfgroup.com.au'
// A loan that was paying nothing and resumed paying nothing owes nothing. Those
// rows made up half of the first query email and gave the lender an easy reason
// to dismiss the whole thing, so they are kept out of the list entirely. Small
// change is the same problem: nobody is chasing a lender for four dollars.
const MIN_VALUE = 5

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const mLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
const mFull = (m: string) => `${FULL[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

// The months between one payment and the next, which are the months to ask about.
//
// Where the loan came back, the two dates are the answer on their own: last paid
// November, back in January, so December is the month to query. Counting
// forward from a months-away figure instead left the column empty on every
// single-month gap in the first export — the dates cannot disagree with
// themselves, so they are used wherever they exist.
function monthsBetween(lastPaid: string, backIn: string | null, away: number): string[] {
  if (!lastPaid) return []
  const out: string[] = []
  let y = Number(lastPaid.slice(0, 4)), n = Number(lastPaid.slice(5, 7))
  if (!y || !n) return []

  if (backIn) {
    const end = backIn.slice(0, 7)
    // A guard, so a bad date can never spin here.
    for (let i = 0; i < 120; i++) {
      n += 1; if (n > 12) { n = 1; y += 1 }
      const m = `${y}-${String(n).padStart(2, '0')}`
      if (m >= end) break
      out.push(m)
    }
    return out
  }

  for (let i = 0; i < Math.max(0, Number(away) || 0); i++) {
    n += 1; if (n > 12) { n = 1; y += 1 }
    out.push(`${y}-${String(n).padStart(2, '0')}`)
  }
  return out
}

type Resolved = { outcome: 'paid' | 'not_owed' | 'queried' | 'arrears'; note: string | null; resolved_at: string }

const OUTCOME_LABEL: Record<string, string> = {
  paid: 'Paid', not_owed: 'Not owed', queried: 'Queried', arrears: 'In arrears',
}

type Gap = {
  broker_key: string; loan_ref: string; client_name: string | null; months_away: number; came_back: boolean
  last_paid: string; returned_in: string | null
  monthly_trail: number; trail_missed: number; balance: number | null; lender: string | null
  // Added 31 Aug 2026. SFG do not skip a missed month - they pay it as an extra
  // line item in a later statement, so the month it came back in carries more
  // payments than that loan normally gets. The view counts them.
  caught_up: boolean | null; extra_payments: number | null
  usual_lines: number | null; lines_at_return: number | null; trail_at_return: number | null
}

export default function MissedTrail({ brokers }: { brokers: { key: string; name: string }[] }) {
  const supabase = createSupabaseBrowser()
  const [gaps, setGaps] = useState<Gap[]>([])
  const [tab, setTab] = useState<'back' | 'away'>('back')
  const [who, setWho] = useState('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [limit, setLimit] = useState<number>(STEPS[0])
  // Once the lender answers, a gap is finished with. Cleared rows drop off the
  // list and stay off, so the same query is not sent twice next month.
  const [resolved, setResolved] = useState<Map<string, Resolved>>(new Map())
  // Arrears is remembered against the LOAN, not against one gap. A gap is keyed
  // by the month it last paid, so the next time the same loan goes quiet that is
  // a brand new key and everything learned in March would be lost. This map is
  // keyed on the loan alone, so the note survives into the next gap.
  const [arrearsByLoan, setArrearsByLoan] = useState<Map<string, string>>(new Map())
  const [showCleared, setShowCleared] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function loadResolved() {
    const { data, error } = await supabase.from('commission_trail_resolved').select('*')
    if (error) { setSaveError('Could not read what has already been cleared.'); return }
    const m = new Map<string, Resolved>()
    const a = new Map<string, string>()
    for (const r of (data || []) as any[]) {
      m.set(`${r.broker_key}|${r.loan_ref}|${String(r.last_paid).slice(0, 10)}`,
            { outcome: r.outcome, note: r.note, resolved_at: r.resolved_at })
      if (r.outcome === 'arrears') {
        const loan = `${r.broker_key}|${r.loan_ref}`
        const seen = a.get(loan)
        // Keep the most recent time it was marked, so the prompt shows the age
        // that matters rather than the first one ever recorded.
        if (!seen || String(r.resolved_at) > seen) a.set(loan, String(r.resolved_at))
      }
    }
    setResolved(m)
    setArrearsByLoan(a)
  }

  useEffect(() => {
    supabase.from('commission_trail_gaps').select('*')
      .order('trail_missed', { ascending: false }).limit(2000)
      .then(({ data }) => setGaps((data || []) as Gap[]))
    loadResolved()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mine = useMemo(
    () => who === 'all' ? gaps : gaps.filter(g => sameBroker(g.broker_key, who)), [gaps, who])

  // Anything worth less than a dollar is noise, not a claim.
  const valued = useMemo(() => mine.filter(g => Number(g.trail_missed || 0) >= MIN_VALUE), [mine])
  const worthless = mine.length - valued.length

  const isMarked = (g: Gap) => resolved.has(`${g.broker_key}|${g.loan_ref}|${String(g.last_paid).slice(0, 10)}`)

  // A query is not an answer. Once the row disappears, a query nobody replied to
  // and a query nobody ever sent look exactly the same - so an unanswered one
  // comes back on the list by itself and says how long it has been waiting.
  const daysSince = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 0
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  }
  // Days before an unanswered query returns to the list. SFG normally come back
  // within a fortnight, so three weeks is late rather than merely pending.
  const CHASE_AFTER_DAYS = 21
  function waitingDays(g: Gap): number {
    const r = resolved.get(`${g.broker_key}|${g.loan_ref}|${String(g.last_paid).slice(0, 10)}`)
    if (!r || r.outcome !== 'queried') return 0
    return daysSince(r.resolved_at)
  }
  const isOverdueQuery = (g: Gap) => waitingDays(g) >= CHASE_AFTER_DAYS
  const isCleared = (g: Gap) => isMarked(g) && !isOverdueQuery(g)
  // Paid more than once in the month it came back. SFG pay a missed month as an
  // extra line in a later statement, so this is very often the missed month
  // already arriving. It is shown as a flag and nothing else: the row stays on
  // the list, the totals do not move, and you decide.
  const isPaidTwice = (g: Gap) => Number(g.extra_payments || 0) > 0

  // Was this loan ever marked as being in arrears, in any earlier gap? Returns
  // when it was last marked, so the row can say how old that is.
  function arrearsBefore(g: Gap): string | null {
    const at = arrearsByLoan.get(`${g.broker_key}|${g.loan_ref}`)
    if (!at) return null
    const thisGap = resolved.get(`${g.broker_key}|${g.loan_ref}|${String(g.last_paid).slice(0, 10)}`)
    // If THIS gap is the one marked arrears, the badge beside it already says so.
    if (thisGap?.outcome === 'arrears' && String(thisGap.resolved_at) === at) return null
    return at
  }
  const monthsSince = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 0
    return Math.max(0, Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
  }
  const open = useMemo(() => showCleared ? valued : valued.filter(g => !isCleared(g)),
                       [valued, resolved, showCleared])
  const clearedCount = valued.filter(isCleared).length
  const paidTwice = valued.filter(isPaidTwice)
  const waiting = valued.filter(g => waitingDays(g) > 0)
  const longestWait = waiting.reduce((m, g) => Math.max(m, waitingDays(g)), 0)
  const recovered = valued
    .filter(g => resolved.get(`${g.broker_key}|${g.loan_ref}|${String(g.last_paid).slice(0, 10)}`)?.outcome === 'paid')
    .reduce((t, g) => t + Number(g.trail_missed || 0), 0)

  const back = useMemo(() => open.filter(g => g.came_back), [open])
  // still away but not yet written off — beyond the threshold it belongs on the Gone list
  const away = useMemo(
    () => open.filter(g => !g.came_back && g.months_away < GONE_AFTER), [open])
  const rows = tab === 'back' ? back : away
  const shown = rows.slice(0, limit)

  const idOf = (g: Gap) => `${g.broker_key}|${g.loan_ref}|${String(g.last_paid).slice(0, 10)}`
  const chosen = rows.filter(g => picked.has(idOf(g)))
  const sum = (rs: Gap[]) => rs.reduce((t, g) => t + Number(g.trail_missed || 0), 0)

  useEffect(() => setLimit(STEPS[0]), [tab, who])

  function toggle(g: Gap) {
    const id = idOf(g), next = new Set(picked)
    next.has(id) ? next.delete(id) : next.add(id)
    setPicked(next)
  }
  function toggleAll() {
    if (chosen.length === rows.length) return setPicked(new Set())
    setPicked(new Set(rows.map(idOf)))
  }

  // Whatever the tab and the broker filter are showing, all of it — not just the
  // rows on screen. A spreadsheet cut short at twenty rows is worse than none.
  function exportCsv() {
    const label = tab === 'back' ? 'came-back' : 'still-missing'
    const name = who === 'all' ? 'all-brokers' : who
    downloadCsv(
      `trail-${label}-${name}-${stamp()}`,
      ['Broker', 'Client', 'Loan reference', 'Lender', 'Balance', 'Monthly trail',
       'Months missed', 'Trail missed', 'Last paid', 'Came back', 'Returned in', 'Months to query', 'Status',
       'Paid more than once', 'In arrears before'],
      rows.map(g => [
        brokers.find(b => sameBroker(g.broker_key, b.key))?.name || g.broker_key,
        g.client_name || '',
        g.loan_ref,
        g.lender || '',
        g.balance ?? '',
        Number(g.monthly_trail || 0).toFixed(2),
        monthsBetween(g.last_paid, g.returned_in, g.months_away).length || g.months_away,
        Number(g.trail_missed || 0).toFixed(2),
        mFull(g.last_paid),
        g.came_back ? 'Yes' : 'No',
        g.returned_in ? mFull(g.returned_in) : '',
        // Prefixed with the count, which reads better and, not incidentally,
        // stops Excel parsing a lone "December 2025" as a date. It was doing
        // that and right-aligning it off the edge of the column, which looked
        // for all the world like an empty cell.
        (() => {
          const ms = monthsBetween(g.last_paid, g.returned_in, g.months_away)
          if (!ms.length) return ''
          return `${ms.length} ${ms.length === 1 ? 'month' : 'months'}: ${ms.map(mFull).join('; ')}`
        })(),
        (() => {
          const label = OUTCOME_LABEL[resolved.get(idOf(g))?.outcome || ''] || 'Open'
          const d = waitingDays(g)
          return d > 0 ? `${label} — ${d} day${d === 1 ? '' : 's'}` : label
        })(),
        isPaidTwice(g)
          ? `Paid ${g.lines_at_return} times${g.returned_in ? ` in ${mFull(g.returned_in)}` : ''} (normally ${g.usual_lines})`
          : '',
        // Carried into the export as well, because this is the column that turns
        // a chase list into "ask about the arrears first".
        (() => {
          const at = arrearsBefore(g)
          return at ? new Date(at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
        })(),
      ]))
  }

  // The draft is prepared, never sent. It opens for you to read, edit and send
  // from your own mail app.
  // Postgres returns no rows and no error when a policy blocks a write, so the
  // result is checked rather than assumed. A silent failure here would mean a
  // query sent twice next month.
  async function mark(outcome: Resolved['outcome']) {
    if (!chosen.length || saving) return
    setSaving(true); setSaveError('')
    const { data: u } = await supabase.auth.getUser()
    const payload = chosen.map(g => ({
      broker_key: g.broker_key,
      loan_ref: g.loan_ref,
      last_paid: String(g.last_paid).slice(0, 10),
      outcome,
      resolved_by: u?.user?.id || null,
      resolved_at: new Date().toISOString(),
    }))
    const { data, error } = await supabase.from('commission_trail_resolved')
      .upsert(payload, { onConflict: 'broker_key,loan_ref,last_paid' }).select()
    if (error || !data || data.length !== payload.length) {
      setSaveError(error?.message || 'Nothing was saved — you may not have permission to clear these.')
      setSaving(false)
      return
    }
    await loadResolved()
    setPicked(new Set())
    setSaving(false)
  }

  async function unmark() {
    if (!chosen.length || saving) return
    setSaving(true); setSaveError('')
    let failed = 0
    for (const g of chosen) {
      const { data, error } = await supabase.from('commission_trail_resolved').delete()
        .eq('broker_key', g.broker_key).eq('loan_ref', g.loan_ref)
        .eq('last_paid', String(g.last_paid).slice(0, 10)).select()
      if (error || !data) failed += 1
    }
    if (failed) setSaveError(`${failed} could not be put back on the list.`)
    await loadResolved()
    setPicked(new Set())
    setSaving(false)
  }

  function compose() {
    const list = chosen.length ? chosen : rows
    if (!list.length) return

    // The same loan can have gone quiet more than once. The lender wants one
    // line per loan with every month on it, not the same account three times.
    type Item = { client: string; loan: string; lender: string; months: string[]; value: number; lastPaid: string }
    const byLoan = new Map<string, Item>()
    for (const g of list) {
      const key = `${g.lender || ''}|${g.loan_ref}`
      const found = byLoan.get(key)
      const ms = monthsBetween(g.last_paid, g.returned_in, g.months_away)
      if (found) {
        found.months = Array.from(new Set([...found.months, ...ms])).sort()
        found.value += Number(g.trail_missed || 0)
        if (g.last_paid > found.lastPaid) found.lastPaid = g.last_paid
      } else {
        byLoan.set(key, {
          client: g.client_name || 'Client not named',
          loan: g.loan_ref,
          lender: g.lender || 'Lender not identified',
          months: ms, value: Number(g.trail_missed || 0), lastPaid: g.last_paid,
        })
      }
    }
    const items = Array.from(byLoan.values())

    const allMonths = new Set<string>()
    for (const it of items) it.months.forEach(m => allMonths.add(m))
    const months = Array.from(allMonths).sort()
    const span = months.length === 0 ? ''
      : months.length === 1 ? mFull(months[0])
      : `${mFull(months[0])} and ${mFull(months[months.length - 1])}`

    const byLender = new Map<string, Item[]>()
    for (const it of items) byLender.set(it.lender, [...(byLender.get(it.lender) || []), it])

    const total = items.reduce((t, it) => t + it.value, 0)
    const n = items.length
    const loans = `${n} ${n === 1 ? 'loan' : 'loans'}`

    const lines: string[] = []
    lines.push('Hello,')
    lines.push('')
    lines.push(
      tab === 'back'
        ? `We are reconciling our trail statements and have found ${loans} where trail did not arrive ` +
          `for one or more months between ${span}. Each of these loans resumed paying afterwards, so ` +
          `the account was open throughout and the trail appears to have been owed.`
        : `We are reconciling our trail statements and have found ${loans} that were paying trail and ` +
          `have not appeared since. Before we treat the trail as ended, we would like to confirm ` +
          `whether the accounts are still open.`)
    lines.push('')
    lines.push(
      tab === 'back'
        ? 'Amounts are our estimate, at the rate each loan was paying when it stopped.'
        : 'Amounts are what has not arrived so far, at the rate each loan was last paying.')
    lines.push('')

    for (const [lender, rs] of Array.from(byLender.entries()).sort()) {
      lines.push(`${lender}`)
      for (const it of rs.sort((a, b) => b.value - a.value)) {
        lines.push(
          tab === 'back'
            ? `  ${it.client} \u2014 ${it.loan} \u2014 ${it.months.map(mLabel).join(', ')} \u2014 ${money(it.value)}`
            : `  ${it.client} \u2014 ${it.loan} \u2014 last paid ${mLabel(it.lastPaid)} \u2014 ${money(it.value)} to date`)
      }
      lines.push('')
    }

    lines.push(`Total ${money(total)} ex GST across ${loans}.`)
    lines.push('')
    lines.push(
      tab === 'back'
        ? 'Could you please confirm whether these months were paid, and if not, include them in the ' +
          'next statement.'
        : 'Could you please confirm the status of these accounts and whether trail remains payable.')
    lines.push('')
    lines.push('Thank you,')
    lines.push('Simplify Finance')

    setDraft({
      to: DEFAULT_TO,
      subject: `Trail not received \u2014 ${loans}${span ? `, ${span}` : ''}`,
      body: lines.join('\n'),
    })
    setCopied(false)
  }

  const card = 'bg-white border rounded-xl'
  const cardS = { borderColor: TONE.line }
  const th = 'px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[.09em] whitespace-nowrap border-b'
  const td = 'px-3 py-[9px] text-[13px] text-right tabular-nums whitespace-nowrap border-b'

  if (gaps.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <div className="inline-flex rounded-lg p-[2px] border" style={{ background: TONE.hair, borderColor: TONE.line }}>
          {([['back', `Came back (${back.length})`], ['away', `Still missing (${away.length})`]] as const).map(([id, lab]) => (
            <button key={id} onClick={() => { setTab(id); setPicked(new Set()) }}
              className="px-3 py-1 text-[12.5px] rounded-[6px]"
              style={tab === id
                ? { background: '#fff', color: TONE.ink, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.07)' }
                : { color: TONE.body }}>{lab}</button>
          ))}
        </div>
        <select value={who} onChange={e => { setWho(e.target.value); setPicked(new Set()) }}
          className="border rounded-lg px-2.5 py-[5px] text-[12.5px] bg-white"
          style={{ borderColor: TONE.line, color: TONE.ink }}>
          <option value="all">Whole business</option>
          {brokers.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
        <span className="text-[12px]" style={{ color: TONE.label }}>
          {tab === 'back'
            ? 'Trail stopped, then resumed — the loan was live all along, so those months were owed.'
            : `Trail stopped under ${GONE_AFTER} months ago. Beyond that it moves to Gone.`}
        </span>
        <button onClick={compose} disabled={rows.length === 0}
          className="ml-auto rounded-lg px-3.5 py-[6px] text-[12.5px] font-medium disabled:opacity-40"
          style={{ background: TONE.accent, color: '#fff' }}>
          Draft email to commissions{chosen.length ? ` (${chosen.length})` : rows.length ? ` (all ${rows.length})` : ''}
        </button>
      </div>

      {/* What has already been dealt with, and what it was worth. */}
      <div className="flex items-center gap-2.5 mb-2 flex-wrap text-[12px]" style={{ color: TONE.label }}>
        <button onClick={() => { setShowCleared(v => !v); setPicked(new Set()) }}
          className="border rounded-lg px-2.5 py-[4px] bg-white"
          style={{ borderColor: TONE.line, color: showCleared ? TONE.ink : TONE.label }}>
          {showCleared ? 'Hide cleared' : `Show cleared (${clearedCount})`}
        </button>
        {recovered > 0 && (
          <span><b style={{ color: TONE.pos }}>{money(recovered)}</b> recovered so far</span>
        )}
        {waiting.length > 0 && (
          <span title={`A query is only tracked while you can see it. Anything unanswered after ${CHASE_AFTER_DAYS} days comes back on the list on its own.`}>
            <b style={{ color: longestWait >= CHASE_AFTER_DAYS ? '#B4761F' : TONE.ink }}>{waiting.length}</b> queried, waiting
            {longestWait >= 14 ? ` · longest ${Math.floor(longestWait / 7)} weeks` : ''}
          </span>
        )}
        {paidTwice.length > 0 && (
          <span title="SFG pay a missed month as an extra line in a later statement, so these are very likely already covered. They stay on the list — check one before you ask about it.">
            <b style={{ color: TONE.pos }}>{paidTwice.length}</b> paid twice in the month they came back
          </span>
        )}
        {saveError && <span style={{ color: TONE.neg }}>{saveError}</span>}
      </div>

      {/* Only once rows are ticked, so the bar is never in the way. */}
      {chosen.length > 0 && (
        <div className="flex items-center gap-2 mb-2 flex-wrap border rounded-xl px-3 py-2"
             style={{ borderColor: TONE.accentLine, background: TONE.accentSoft }}>
          <span className="text-[12.5px]" style={{ color: TONE.ink }}>
            {chosen.length} selected
          </span>
          <button onClick={() => mark('paid')} disabled={saving}
            className="rounded-lg px-3 py-[5px] text-[12px] font-medium border bg-white disabled:opacity-40"
            style={{ borderColor: '#CFE6D5', color: TONE.pos }}>They paid it</button>
          <button onClick={() => mark('not_owed')} disabled={saving}
            className="rounded-lg px-3 py-[5px] text-[12px] font-medium border bg-white disabled:opacity-40"
            style={{ borderColor: TONE.line, color: TONE.body }}>Not owed</button>
          <button onClick={() => mark('queried')} disabled={saving}
            className="rounded-lg px-3 py-[5px] text-[12px] font-medium border bg-white disabled:opacity-40"
            style={{ borderColor: TONE.line, color: TONE.body }}>Queried, waiting</button>
          {/* The trail is still owed - the borrower is behind. Marked against the
              loan so the next gap on the same loan says so before you chase it. */}
          <button onClick={() => mark('arrears')} disabled={saving}
            className="rounded-lg px-3 py-[5px] text-[12px] font-medium border disabled:opacity-40"
            style={{ borderColor: '#EBD9BE', background: '#FDF6EC', color: '#B4761F' }}>In arrears</button>
          {showCleared && (
            <button onClick={unmark} disabled={saving}
              className="rounded-lg px-3 py-[5px] text-[12px] border bg-white disabled:opacity-40 ml-auto"
              style={{ borderColor: TONE.line, color: TONE.label }}>Put back on the list</button>
          )}
          <span className="text-[11.5px]" style={{ color: TONE.label }}>
            {saving ? 'Saving…' : 'Clearing a row hides it here and keeps it out of the next email.'}
          </span>
        </div>
      )}

      <div className={card + ' overflow-x-auto'} style={cardS}>
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className={th + ' text-left w-[34px]'} style={{ color: TONE.label, borderColor: TONE.hair }}>
                <input type="checkbox" checked={rows.length > 0 && chosen.length === rows.length}
                       onChange={toggleAll} aria-label="Select all" />
              </th>
              {['Client', 'Loan', 'Broker', 'Lender', 'Last paid', tab === 'back' ? 'Resumed' : 'Silent since',
                'Months missing', 'Trail missed'].map((h, i) => (
                <th key={h} className={th + (i < 4 ? ' text-left' : ' text-right')}
                    style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-[13px]" style={{ color: TONE.label }}>
                Nothing here{who === 'all' ? '' : ' for this broker'}.
              </td></tr>
            )}
            {shown.map((g, i) => (
              <tr key={idOf(g)} style={{ background: picked.has(idOf(g)) ? TONE.accentSoft : i % 2 ? TONE.zebra : '#fff' }}>
                <td className="px-3 py-[9px] border-b" style={{ borderColor: TONE.hair }}>
                  <input type="checkbox" checked={picked.has(idOf(g))} onChange={() => toggle(g)}
                         aria-label={`Select loan ${g.loan_ref}`} />
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>
                  {g.client_name || '—'}
                  {/* Only visible while cleared rows are being shown, so the list
                      stays plain the rest of the time. */}
                  {isPaidTwice(g) && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[1px] border align-middle"
                          style={{ borderColor: '#CFE6D5', color: TONE.pos, background: '#F1F7F3' }}
                          title={`This loan was paid ${g.lines_at_return} times${g.returned_in ? ` in ${mLabel(g.returned_in)}` : ''}, where it normally gets ${g.usual_lines} a month. SFG pay a missed month as an extra line in a later statement, so this is very likely the missed month. Worth checking before you ask.`}>
                      Paid twice{g.returned_in ? ` in ${mLabel(g.returned_in)}` : ''}
                    </span>
                  )}
                  {isMarked(g) && (() => {
                    const d = waitingDays(g)
                    const late = isOverdueQuery(g)
                    const age = d >= 14 ? `${Math.floor(d / 7)} weeks` : d === 1 ? '1 day' : `${d} days`
                    return (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[1px] border align-middle"
                            style={late
                              ? { borderColor: '#EBD9BE', color: '#B4761F', background: '#FDF6EC' }
                              : { borderColor: TONE.line, color: TONE.label, background: '#fff' }}
                            title={d > 0
                              ? `Queried ${age} ago${late ? ' and still no answer, so it is back on the list' : ''}.`
                              : undefined}>
                        {OUTCOME_LABEL[resolved.get(idOf(g))?.outcome || ''] || 'Cleared'}
                        {d > 0 ? ` · ${age}` : ''}
                      </span>
                    )
                  })()}
                  {/* This loan has been in arrears before. A prompt, never an
                      answer - it is a reason to check, not a reason to clear. */}
                  {(() => {
                    const at = arrearsBefore(g)
                    if (!at) return null
                    const m = monthsSince(at)
                    return (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[1px] border align-middle"
                            style={{ borderColor: '#EBD9BE', color: '#B4761F', background: '#FDF6EC' }}
                            title={`Marked in arrears on ${new Date(at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}. Worth checking whether that is still the reason.`}>
                        Was in arrears{m > 0 ? ` · ${m} month${m === 1 ? '' : 's'} ago` : ''}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.body, borderColor: TONE.hair }}>{g.loan_ref}</td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {brokers.find(b => sameBroker(b.key, g.broker_key))?.name.split(' ')[0] || g.broker_key}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {g.lender || '—'}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>{mLabel(g.last_paid)}</td>
                <td className={td} style={{ color: g.returned_in ? TONE.pos : '#B4761F', borderColor: TONE.hair }}>
                  {g.returned_in ? mLabel(g.returned_in) : 'nothing yet'}
                </td>
                <td className={td} style={{ color: TONE.ink, borderColor: TONE.hair }}>
                  {monthsBetween(g.last_paid, g.returned_in, g.months_away).map(mLabel).join(', ')}
                </td>
                <td className={td + ' font-[640]'} style={{ color: TONE.neg, borderColor: TONE.hair }}>
                  {money(-Math.abs(Number(g.trail_missed || 0)))}
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ background: TONE.hair }}>
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="px-3 py-[9px] text-[13px] font-[640] border-t"
                    style={{ color: TONE.ink, borderColor: TONE.line }}>
                  {rows.length} {rows.length === 1 ? 'episode' : 'episodes'}
                </td>
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className="border-t" style={{ borderColor: TONE.line }} />
                <td className={td + ' font-[640] border-b-0 border-t'} style={{ color: TONE.ink, borderColor: TONE.line }}>
                  {rows.reduce((t, g) => t + g.months_away, 0)} months
                </td>
                <td className={td + ' font-[640] border-b-0 border-t'} style={{ color: TONE.neg, borderColor: TONE.line }}>
                  {money(-sum(rows))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center gap-2 flex-wrap">
          <RowLimit shown={shown.length} total={rows.length} limit={limit} onChange={setLimit} />
          <button onClick={exportCsv} disabled={!rows.length}
                  className="text-[11.5px] border rounded-md px-2.5 py-[3px] bg-white disabled:opacity-40 mr-3"
                  style={{ borderColor: TONE.line, color: TONE.label }}>
            Export {rows.length} to Excel
          </button>
        </div>
        <div className="px-3 py-2.5 border-t text-[11.5px]" style={{ borderColor: TONE.hair, color: TONE.label }}>
          Trail missed is the months of silence at the rate the loan was paying when it stopped. Tick the rows you
          want, or leave them all unticked to include every one in the email. The export takes every row on this
          tab, not just the ones on screen.
          {worthless > 0 && (
            <> {' '}<b style={{ color: TONE.ink }}>{worthless} gap{worthless === 1 ? '' : 's'} worth under ${MIN_VALUE}
            {worthless === 1 ? ' is' : ' are'} not shown</b> — too small to be worth a lender's time, and a list
            full of them invites the whole query to be dismissed.</>
          )}
        </div>
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(34,31,27,.42)' }} onClick={() => setDraft(null)}>
          <div className="bg-white rounded-xl border w-full max-w-[760px] max-h-[86vh] flex flex-col"
               style={{ borderColor: TONE.line }} onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: TONE.hair }}>
              <span className="text-[14px] font-semibold" style={{ color: TONE.ink }}>Draft — not sent</span>
              <button onClick={() => setDraft(null)} className="text-[13px]" style={{ color: TONE.label }}>Close</button>
            </div>
            <div className="p-4 grid gap-2.5 overflow-y-auto">
              <label className="text-[11px] font-bold uppercase tracking-[.08em]" style={{ color: TONE.label }}>To</label>
              <input value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })}
                     className="border rounded-lg px-3 py-2 text-[13px]"
                     style={{ borderColor: TONE.line, color: TONE.ink }} />
              <label className="text-[11px] font-bold uppercase tracking-[.08em]" style={{ color: TONE.label }}>Subject</label>
              <input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })}
                     className="border rounded-lg px-3 py-2 text-[13px]"
                     style={{ borderColor: TONE.line, color: TONE.ink }} />
              <label className="text-[11px] font-bold uppercase tracking-[.08em]" style={{ color: TONE.label }}>Message</label>
              <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })}
                        rows={18} className="border rounded-lg px-3 py-2 text-[12.5px] font-mono leading-[1.5]"
                        style={{ borderColor: TONE.line, color: TONE.ink }} />
            </div>
            <div className="px-4 py-3 border-t flex items-center gap-2.5" style={{ borderColor: TONE.hair }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(draft.body).then(() => setCopied(true))
                }}
                className="rounded-lg px-3.5 py-[7px] text-[12.5px] border"
                style={{ borderColor: TONE.line, color: TONE.ink }}>
                {copied ? 'Copied' : 'Copy message'}
              </button>
              <a href={`mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                 className="rounded-lg px-3.5 py-[7px] text-[12.5px] font-medium"
                 style={{ background: TONE.accent, color: '#fff' }}>
                Open in mail
              </a>
              <span className="text-[11.5px] ml-auto" style={{ color: TONE.label }}>
                Nothing is sent from the portal — this opens in your own mail app.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
