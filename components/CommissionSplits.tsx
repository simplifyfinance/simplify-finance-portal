'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { SkelPanel } from '@/components/Skeleton'
import {
  splitFromRow, termsInWords, splitKindLabel, SPLIT_KINDS,
  readPct, type Split, type SplitKind,
} from '@/lib/who-shares-this-deal'

// WHO SHARES A DEAL - THE LIST, IN SETTINGS.
//
// 27 Oct 2026. Fabio: "I rather build a section in settings so we can load all
// commisions by name so broker can seelect in Fact Find Stage what commission
// split to select so it carries accross to handover notes".
//
// IT SITS ABOVE THE COMMISSION LIBRARY AND IS NOT THE SAME THING. The library
// below is what the BANKS PAY US - upfront, trail and clawback per lender.
// This is money going the other way. Two lists, two directions, and the
// heading on each says which so nobody has to remember.
//
// SWITCHED OFF, NEVER DELETED. A deal that used an arrangement has to keep
// making sense years later, and the deal keeps its own copy of the terms for
// the same reason - see lib/who-shares-this-deal.ts. Switching one off takes
// it out of the broker's dropdown and touches no deal at all.

const INP = 'w-full text-[13px] border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-brand'
const PCT = 'w-20 text-[13px] border border-line rounded-lg px-2 py-2 text-ink text-right tabular-nums focus:outline-none focus:border-brand'
const TAG = 'text-[10px] font-bold rounded-full px-2 py-[2px] whitespace-nowrap border'

type Row = Split & { dirty?: boolean }

export default function CommissionSplits() {
  const supabase = createSupabaseBrowser()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('commission_splits')
      .select('*').order('active', { ascending: false }).order('name')
    if (error) {
      setErr(/relation .* does not exist/i.test(error.message)
        ? 'The commission splits table is not set up yet. Run docs/who-shares-this-deal.sql in Supabase.'
        : error.message)
    } else {
      setRows((data || []).map(splitFromRow))
    }
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const edit = (id: string, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch, dirty: true } : r))

  async function save(r: Row) {
    setSaving(r.id); setErr('')
    const patch = {
      name: r.name.trim(), kind: r.kind, who: r.who.trim() || null,
      contact_email: r.contactEmail.trim() || null,
      upfront_pct: r.upfront, trail_pct: r.trail,
      notes: r.notes.trim() || null, active: r.active,
      updated_at: new Date().toISOString(),
    }
    // A blocked policy returns no rows and no error, so the row is the proof.
    const { data, error } = await supabase.from('commission_splits')
      .update(patch).eq('id', r.id).select('id')
    if (error || !data?.length) {
      setErr(error?.message || 'That was not saved — nothing reached the database.')
    } else {
      setRows(rs => rs.map(x => x.id === r.id ? { ...x, dirty: false } : x))
    }
    setSaving(null)
  }

  async function add() {
    setErr('')
    const { data, error } = await supabase.from('commission_splits')
      .insert({ name: 'New arrangement', kind: 'referrer', active: true }).select('*')
    if (error || !data?.length) {
      setErr(error?.message || 'That was not added — nothing reached the database.')
      return
    }
    setRows(rs => [splitFromRow(data[0]), ...rs])
  }

  // THE SHAPE, NOT THE WORD. A line of grey text saying "Loading" is the
  // thing lib/the-portal-says-it-is-busy.test.ts exists to keep out of the
  // portal - it tells somebody nothing except that the screen is not ready.
  if (loading) return <SkelPanel lines={3} />

  return (
    <div className="border border-[#EDE7DD] rounded-xl p-5 bg-card">
      <p className="text-[11.5px] text-faint mb-4 max-w-[680px] leading-relaxed">
        Who shares a deal, and on what terms. Set once here, chosen by the broker on the fact find,
        carried to the handover and onto compliance. <b className="text-body">This is money going out</b> —
        what the banks pay us is the Commission library below.
      </p>

      {err && <p className="text-[12px] text-chase mb-3">{err}</p>}

      {rows.length === 0 && (
        <p className="text-[12.5px] text-faint mb-3">
          Nothing here yet. Add the first arrangement and it appears on every fact find.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map(r => (
          <div key={r.id}
            className={`border rounded-xl px-4 py-3 ${r.active ? 'border-card-line bg-card' : 'border-field-line bg-page'}`}>
            <div className="flex gap-2 items-center flex-wrap mb-2">
              <input className={`${INP} flex-1 min-w-[200px] font-semibold`} value={r.name}
                onChange={e => edit(r.id, { name: e.target.value })} placeholder="Name the arrangement" />
              <select className="text-[12px] border border-line rounded-lg px-2 py-2 text-ink bg-card"
                value={r.kind} onChange={e => edit(r.id, { kind: e.target.value as SplitKind })}>
                {SPLIT_KINDS.map(k => <option key={k} value={k}>{splitKindLabel(k)}</option>)}
              </select>
              <span className={`${TAG} ${r.active
                ? 'bg-done-bg text-done border-done-edge' : 'bg-line-soft text-faint border-field-line'}`}>
                {r.active ? 'In use' : 'Not in use'}
              </span>
            </div>

            <div className="flex gap-2 items-center flex-wrap mb-2">
              <input className={`${INP} flex-1 min-w-[180px]`} value={r.who}
                onChange={e => edit(r.id, { who: e.target.value })}
                placeholder={r.kind === 'broker_split' ? 'Mark Gallo → Justin Cornock' : 'Who, in person'} />
              <input className={`${INP} flex-1 min-w-[180px]`} value={r.contactEmail}
                onChange={e => edit(r.id, { contactEmail: e.target.value })} placeholder="Email (optional)" />
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              <label className="text-[11px] text-faint">Upfront</label>
              <input className={PCT} value={r.upfront === null ? '' : String(r.upfront)}
                onChange={e => edit(r.id, { upfront: readPct(e.target.value) })} placeholder="—" />
              <span className="text-[12px] text-faint">%</span>
              <label className="text-[11px] text-faint ml-2">Trail</label>
              <input className={PCT} value={r.trail === null ? '' : String(r.trail)}
                onChange={e => edit(r.id, { trail: readPct(e.target.value) })} placeholder="—" />
              <span className="text-[12px] text-faint">%</span>
              <input className={`${INP} flex-1 min-w-[160px] ml-2`} value={r.notes}
                onChange={e => edit(r.id, { notes: e.target.value })} placeholder="Notes" />
            </div>

            <div className="flex gap-2 items-center flex-wrap mt-2.5">
              <span className="text-[11.5px] text-muted flex-1">
                The broker sees: <b className="text-ink">{r.name || 'Unnamed'}</b> — {splitKindLabel(r.kind).toLowerCase()} · {termsInWords(r.upfront, r.trail)}
              </span>
              {/* NEVER A DELETE. A deal that used this has to keep making sense. */}
              <button onClick={() => edit(r.id, { active: !r.active })}
                className="text-[12px] border border-card-line bg-card rounded-lg px-3 py-1.5 text-body hover:bg-page">
                {r.active ? 'Stop using it' : 'Use it again'}
              </button>
              <button onClick={() => save(r)} disabled={!r.dirty || saving === r.id}
                className="text-[12px] font-semibold text-[#0E8FCB] bg-card border border-[#BFE6F9] rounded-lg px-4 py-1.5 hover:bg-[#EAF7FE] disabled:opacity-40">
                {saving === r.id ? 'Saving…' : r.dirty ? 'Save' : 'Saved'}
              </button>
            </div>

            {!r.active && (
              <p className="text-[11px] text-faint mt-2 leading-relaxed">
                Not offered on new deals. Every deal that already used it is untouched and still reads correctly.
              </p>
            )}
          </div>
        ))}
      </div>

      <button onClick={add}
        className="text-[12.5px] font-semibold text-[#0E8FCB] bg-card border border-[#BFE6F9] rounded-lg px-4 py-2 mt-4 hover:bg-[#EAF7FE] transition">
        + Add a split
      </button>
    </div>
  )
}
