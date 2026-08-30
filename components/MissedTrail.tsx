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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const mLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
const mFull = (m: string) => `${FULL[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

// The months between one payment and the next, which are the months to ask about.
function monthsBetween(lastPaid: string, backIn: string | null, away: number): string[] {
  const out: string[] = []
  let y = Number(lastPaid.slice(0, 4)), n = Number(lastPaid.slice(5, 7))
  for (let i = 0; i < away; i++) {
    n += 1; if (n > 12) { n = 1; y += 1 }
    out.push(`${y}-${String(n).padStart(2, '0')}`)
  }
  return out
}

type Gap = {
  broker_key: string; loan_ref: string; client_name: string | null; months_away: number; came_back: boolean
  last_paid: string; returned_in: string | null
  monthly_trail: number; trail_missed: number; balance: number | null; lender: string | null
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

  useEffect(() => {
    supabase.from('commission_trail_gaps').select('*')
      .order('trail_missed', { ascending: false }).limit(2000)
      .then(({ data }) => setGaps((data || []) as Gap[]))
  }, [])

  const mine = useMemo(
    () => who === 'all' ? gaps : gaps.filter(g => sameBroker(g.broker_key, who)), [gaps, who])

  const back = useMemo(() => mine.filter(g => g.came_back), [mine])
  // still away but not yet written off — beyond the threshold it belongs on the Gone list
  const away = useMemo(
    () => mine.filter(g => !g.came_back && g.months_away < GONE_AFTER), [mine])
  const rows = tab === 'back' ? back : away
  const shown = rows.slice(0, limit)

  const idOf = (g: Gap) => `${g.broker_key}|${g.loan_ref}|${g.last_paid}`
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
       'Months missed', 'Trail missed', 'Last paid', 'Came back', 'Returned in', 'Months to query'],
      rows.map(g => [
        brokers.find(b => sameBroker(g.broker_key, b.key))?.name || g.broker_key,
        g.client_name || '',
        g.loan_ref,
        g.lender || '',
        g.balance ?? '',
        Number(g.monthly_trail || 0).toFixed(2),
        g.months_away,
        Number(g.trail_missed || 0).toFixed(2),
        mFull(g.last_paid),
        g.came_back ? 'Yes' : 'No',
        g.returned_in ? mFull(g.returned_in) : '',
        monthsBetween(g.last_paid, g.returned_in, g.months_away).map(mFull).join('; '),
      ]))
  }

  // The draft is prepared, never sent. It opens for you to read, edit and send
  // from your own mail app.
  function compose() {
    const list = chosen.length ? chosen : rows
    if (!list.length) return
    const allMonths = new Set<string>()
    for (const g of list) monthsBetween(g.last_paid, g.returned_in, g.months_away).forEach(m => allMonths.add(m))
    const months = Array.from(allMonths).sort()
    const span = months.length === 1 ? mFull(months[0])
      : `${mFull(months[0])} to ${mFull(months[months.length - 1])}`

    const byLender = new Map<string, Gap[]>()
    for (const g of list) {
      const k = g.lender || 'Lender not identified'
      byLender.set(k, [...(byLender.get(k) || []), g])
    }

    const lines: string[] = []
    lines.push('Hello,')
    lines.push('')
    lines.push(
      `We are reconciling our trail statements and have found ${list.length} ` +
      `${list.length === 1 ? 'loan' : 'loans'} where trail did not appear for one or more months ` +
      `between ${span}.`)
    lines.push('')
    lines.push(
      tab === 'back'
        ? 'In each case the loan resumed paying trail afterwards, so the loan was still active and the ' +
          'commission appears to have been owed for the months in between.'
        : 'These loans were paying trail and have not appeared since. We would like to confirm whether they ' +
          'are still active before we treat the trail as ended.')
    lines.push('')
    for (const [lender, rs] of Array.from(byLender.entries()).sort()) {
      lines.push(`${lender}`)
      for (const g of rs.sort((a, b) => b.trail_missed - a.trail_missed)) {
        const miss = monthsBetween(g.last_paid, g.returned_in, g.months_away).map(mLabel).join(', ')
        lines.push(
          `  ${g.client_name || 'Client not named'} — loan ${g.loan_ref}, last paid ${mLabel(g.last_paid)}` +
          (g.returned_in ? `, resumed ${mLabel(g.returned_in)}` : ', nothing since') +
          `. Missing: ${miss}. Approximately ${money(g.trail_missed)} ex GST at the ` +
          `${money(g.monthly_trail)} a month it was paying.`)
      }
      lines.push('')
    }
    lines.push(`Total in question: ${money(sum(list))} ex GST across ${list.length} ` +
               `${list.length === 1 ? 'loan' : 'loans'}.`)
    lines.push('')
    lines.push('Could you please confirm whether these months were paid, and if not, arrange for them to be ' +
               'included in the next statement.')
    lines.push('')
    lines.push('Thank you,')
    lines.push('Simplify Finance')

    setDraft({
      to: DEFAULT_TO,
      subject: `Trail not received — ${list.length} ${list.length === 1 ? 'loan' : 'loans'}, ${span}`,
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
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>{g.client_name || '—'}</td>
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
