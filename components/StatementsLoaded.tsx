'use client'
import { useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { TONE, money } from '@/lib/tone'
import { brokerKey as normKey } from '@/lib/broker-key'
import { downloadCsv, stamp } from '@/lib/csv'
import RowLimit, { STEPS } from '@/components/RowLimit'

// Everything that has been loaded, and where each figure came from.
//
// Every number on this page traces back to one of these rows. Without a list,
// answering "where did that come from" meant writing SQL, and removing a file
// that should not have been loaded meant writing more.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const mLabel = (m: string) => `${MONTHS[Number(String(m).slice(5, 7)) - 1]} ${String(m).slice(2, 4)}`

export default function StatementsLoaded({ statements, brokers, onChanged }: {
  statements: any[]
  brokers: { key: string; name: string }[]
  onChanged: () => void
}) {
  const [who, setWho] = useState('all')
  const [limit, setLimit] = useState<number>(STEPS[0])
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  // The rows behind a referral figure, fetched only when somebody asks for them.
  const supabase = createSupabaseBrowser()
  const [openRefs, setOpenRefs] = useState<string | null>(null)
  const [refRows, setRefRows] = useState<any[] | null>(null)

  async function showReferrals(id: string) {
    if (openRefs === id) { setOpenRefs(null); return }
    setOpenRefs(id); setRefRows(null)
    const { data } = await supabase.from('commission_referral_lines')
      .select('*').eq('statement_id', id).order('commission_ex_gst', { ascending: false })
    setRefRows(data || [])
  }

  const rows = useMemo(() => {
    const mine = who === 'all' ? statements
      : statements.filter(s => normKey(s.broker_key) === who)
    return [...mine].sort((a, b) =>
      String(b.period_month).localeCompare(String(a.period_month)) ||
      String(a.kind).localeCompare(String(b.kind)))
  }, [statements, who])

  const shown = rows.slice(0, limit)
  const banked = rows.reduce((t, s) => t + Number(s.banked_ex_gst || 0), 0)

  async function remove(s: any) {
    setBusy(s.id); setErr(''); setNote('')
    try {
      const res = await fetch('/api/commission-statement', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setErr(json?.error || `Could not remove it (${res.status}). Nothing was changed.`)
      } else {
        setNote(`Removed ${s.filename} — ${json.removedLines} lines. Upload the right file when you have it.`)
        onChanged()
      }
    } catch {
      setErr('Could not reach the server. Nothing was changed.')
    }
    setBusy(''); setConfirming(null)
  }

  function exportCsv() {
    downloadCsv(`statements-loaded-${stamp()}`,
      ['Period', 'Kind', 'Broker', 'Filename', 'Rows', 'Gross', 'Third parties',
       'Clawback', 'Referrals', 'Banked', 'Uploaded'],
      rows.map(s => [
        String(s.period_month).slice(0, 7), s.kind,
        brokers.find(b => b.key === normKey(s.broker_key))?.name || s.broker_key,
        s.filename, s.rows_imported,
        Number(s.gross_ex_gst || 0).toFixed(2),
        Number(s.third_party_ex_gst || 0).toFixed(2),
        Number(s.clawback_ex_gst || 0).toFixed(2),
        Number(s.referrals_ex_gst || 0).toFixed(2),
        Number(s.banked_ex_gst || 0).toFixed(2),
        String(s.uploaded_at || '').slice(0, 10),
      ]))
  }

  if (!statements.length) return null

  const card = 'bg-white border rounded-xl'
  const cardS = { borderColor: TONE.line }
  const th = 'px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[.09em] whitespace-nowrap border-b'
  const td = 'px-3 py-[9px] text-[13px] text-right tabular-nums whitespace-nowrap border-b'

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <div className="text-[11px] font-bold tracking-[.08em] uppercase" style={{ color: TONE.label }}>
          Statements loaded
        </div>
        <select value={who} onChange={e => setWho(e.target.value)}
          className="border rounded-lg px-2.5 py-[5px] text-[12.5px] bg-white"
          style={{ borderColor: TONE.line, color: TONE.ink }}>
          <option value="all">Whole business</option>
          {brokers.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
        <span className="text-[12px]" style={{ color: TONE.label }}>
          {rows.length} {rows.length === 1 ? 'statement' : 'statements'}, {money(banked)} banked between them.
        </span>
        {err && <span className="text-[12px]" style={{ color: TONE.neg }}>{err}</span>}
        {note && <span className="text-[12px]" style={{ color: TONE.pos }}>{note}</span>}
      </div>

      <div className={card + ' overflow-x-auto'} style={cardS}>
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              {['Period', 'Kind', 'Broker', 'File', 'Rows', 'Gross', 'Referrals', 'Banked', ''].map((h, i) => (
                <th key={h || 'act'} className={th + (i < 4 ? ' text-left' : ' text-right')}
                    style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 ? TONE.zebra : '#fff' }}>
                <td className="px-3 py-[9px] text-[13px] border-b"
                    style={{ color: TONE.ink, fontWeight: 520, borderColor: TONE.hair }}>
                  {mLabel(s.period_month)}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {s.kind}
                </td>
                <td className="px-3 py-[9px] text-[13px] border-b" style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {brokers.find(b => b.key === normKey(s.broker_key))?.name.split(' ')[0] || s.broker_key}
                </td>
                {/* The filename is the whole point: it is how a figure on this
                    page is traced back to a file on somebody's disk. */}
                <td className="px-3 py-[9px] text-[12.5px] border-b break-all"
                    style={{ color: TONE.label, borderColor: TONE.hair, maxWidth: 260 }}>
                  {s.filename}
                </td>
                <td className={td} style={{ color: TONE.label, borderColor: TONE.hair }}>{s.rows_imported}</td>
                <td className={td} style={{ color: TONE.body, borderColor: TONE.hair }}>
                  {money(Number(s.gross_ex_gst || 0))}
                </td>
                <td className={td}
                    style={{ color: Number(s.referrals_ex_gst || 0) ? TONE.ink : TONE.faint, borderColor: TONE.hair }}>
                  {Number(s.referrals_ex_gst || 0)
                    ? <button onClick={() => showReferrals(s.id)}
                              className="underline underline-offset-2"
                              style={{ color: TONE.accent }}>
                        {money(Number(s.referrals_ex_gst || 0))}
                      </button>
                    : money(0)}
                </td>
                <td className={td} style={{ color: TONE.ink, fontWeight: 640, borderColor: TONE.hair }}>
                  {money(Number(s.banked_ex_gst || 0))}
                </td>
                <td className="px-3 py-[9px] text-right border-b whitespace-nowrap" style={{ borderColor: TONE.hair }}>
                  {confirming === s.id ? (
                    <>
                      <button onClick={() => remove(s)} disabled={busy === s.id}
                              className="text-[11.5px] border rounded-md px-2 py-[3px] bg-white disabled:opacity-40"
                              style={{ borderColor: '#E8CFC6', color: TONE.neg }}>
                        {busy === s.id ? 'Removing…' : 'Yes, remove'}
                      </button>
                      <button onClick={() => setConfirming(null)}
                              className="text-[11.5px] ml-1.5" style={{ color: TONE.label }}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => { setConfirming(s.id); setErr(''); setNote('') }}
                            className="text-[11.5px] border rounded-md px-2 py-[3px] bg-white"
                            style={{ borderColor: TONE.line, color: TONE.label }}>Remove</button>
                  )}
                </td>
              </tr>
            )).flatMap((tr, i) => {
              const s = shown[i]
              if (openRefs !== s.id) return [tr]
              return [tr, (
                <tr key={s.id + '-refs'}>
                  <td colSpan={9} className="px-3 py-3 border-b" style={{ background: TONE.zebra, borderColor: TONE.hair }}>
                    {refRows === null ? (
                      <span className="text-[12px]" style={{ color: TONE.label }}>Looking&hellip;</span>
                    ) : refRows.length === 0 ? (
                      <span className="text-[12px]" style={{ color: TONE.label }}>
                        This statement was loaded before the portal started keeping these rows, so only the total
                        survives. Remove it and upload the same file again and the breakdown will appear.
                      </span>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr>
                            {['Whose loan', 'Lender', 'Client', 'Type', 'Arrangement', 'Rate', 'Amount'].map((h, j) => (
                              <th key={h} className={th + (j < 5 ? ' text-left' : ' text-right')}
                                  style={{ color: TONE.label, borderColor: TONE.hair }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {refRows.map(r => (
                            <tr key={r.id}>
                              <td className="px-3 py-[7px] text-[12.5px]" style={{ color: TONE.body }}>{r.source_broker || '—'}</td>
                              <td className="px-3 py-[7px] text-[12.5px]" style={{ color: TONE.body }}>{r.lender_raw || '—'}</td>
                              <td className="px-3 py-[7px] text-[12.5px]" style={{ color: TONE.ink }}>{r.client_name || '—'}</td>
                              <td className="px-3 py-[7px] text-[12.5px]" style={{ color: TONE.body }}>{r.row_type || '—'}</td>
                              <td className="px-3 py-[7px] text-[12px]" style={{ color: TONE.label }}>{r.split_name || '—'}</td>
                              <td className="px-3 py-[7px] text-[12.5px] text-right tabular-nums" style={{ color: TONE.label }}>
                                {r.payment_rate ? `${r.payment_rate}%` : '—'}
                              </td>
                              <td className="px-3 py-[7px] text-[12.5px] text-right tabular-nums font-[640]"
                                  style={{ color: Number(r.commission_ex_gst) < 0 ? TONE.neg : TONE.ink }}>
                                {money(Number(r.commission_ex_gst || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )]
            })}
          </tbody>
        </table>
        <div className="flex items-center gap-2 flex-wrap">
          <RowLimit shown={shown.length} total={rows.length} limit={limit} onChange={setLimit} />
          <button onClick={exportCsv} className="text-[11.5px] border rounded-md px-2.5 py-[3px] bg-white mr-3"
                  style={{ borderColor: TONE.line, color: TONE.label }}>
            Export {rows.length} to Excel
          </button>
        </div>
        <div className="px-3 py-2.5 border-t text-[11.5px]" style={{ borderColor: TONE.hair, color: TONE.label }}>
          Every figure on this page comes from one of these files. Removing one takes its lines with it and the
          page recalculates — it does not hide the statement, it deletes it, so upload the correct file afterwards.
          The period is the month the commission covers, not the month it was paid: trail arrives two months later,
          which is why a file called September carries July&rsquo;s trail.
        </div>
      </div>
    </div>
  )
}
