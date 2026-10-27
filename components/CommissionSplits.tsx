'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { SkelPanel } from '@/components/Skeleton'
import {
  splitFromRow, splitKindLabel, SPLIT_KINDS, readPct, blankLine,
  totalsOf, addsUpWarning, linesInWords,
  type Split, type SplitKind, type Line,
} from '@/lib/who-shares-this-deal'

// WHO SHARES A DEAL - THE LIST, IN SETTINGS.
//
// 27 Oct 2026. Fabio: "I rather build a section in settings so we can load all
// commisions by name so broker can seelect in Fact Find Stage what commission
// split to select so it carries accross to handover notes".
//
// ITS OWN ENTRY IN THE SETTINGS MENU, AND NOT THE COMMISSION LIBRARY. The
// library is what the BANKS PAY US - upfront, trail and clawback per lender.
// This is money going the other way. It shipped inside the library's pane and
// Fabio went looking and could not find it: "where in that phots shows
// commission library???". Two lists, two directions, two names in the menu.
//
// AN ARRANGEMENT IS A LIST OF LINES. Fabio, the same day: "we need the ability
// of addint lines for upfront and trail so line one for exmaple 20% simplify
// line 80% broker 1 and abilty to add third line". One pair of percentages
// could only ever say what ONE party gets.
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
  const [confirming, setConfirming] = useState<string | null>(null)
  // SUGGESTIONS, NOT A LIST YOU ARE STUCK INSIDE.
  //
  // 27 Oct 2026. Who gets a share is typed, because a referrer is whoever the
  // broker says it is and a list that cannot hold them is a box nobody can
  // fill in. The names already in the portal are offered so the common ones
  // stay spelled the same - the brokers, and the businesses in the directory.
  const [names, setNames] = useState<string[]>([])

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

  useEffect(() => {
    Promise.all([
      supabase.from('brokers').select('name, active'),
      supabase.from('directory_people').select('business'),
    ]).then(([b, d]: any[]) => {
      const brokers = (b.data || []).filter((x: any) => x.active !== false).map((x: any) => String(x.name || ''))
      const businesses = (d.data || []).map((x: any) => String(x.business || ''))
      setNames([...new Set([...brokers, ...businesses])].filter(Boolean).sort())
    }).catch(() => { /* suggestions are a convenience, never a blocker */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const edit = (id: string, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch, dirty: true } : r))

  const editLine = (id: string, i: number, patch: Partial<Line>) =>
    edit(id, { lines: (rows.find(r => r.id === id)?.lines || []).map((l, k) => k === i ? { ...l, ...patch } : l) })

  const addLine = (id: string) =>
    edit(id, { lines: [...(rows.find(r => r.id === id)?.lines || []), blankLine()] })

  // NEVER THE LAST ONE. An arrangement with no lines at all cannot say
  // anything, and an empty table reads as a broken screen rather than a choice.
  const dropLine = (id: string, i: number) => {
    const list = rows.find(r => r.id === id)?.lines || []
    edit(id, { lines: list.length > 1 ? list.filter((_, k) => k !== i) : [blankLine()] })
  }

  async function save(r: Row) {
    setSaving(r.id); setErr('')
    const patch = {
      name: r.name.trim(), kind: r.kind, who: r.who.trim() || null,
      contact_email: r.contactEmail.trim() || null,
      upfront_pct: r.upfront, trail_pct: r.trail,
      // The lines are the arrangement now. Empty ones are dropped rather than
      // saved as a row of nothing.
      lines: r.lines.filter(l => l.who.trim() || l.upfront !== null || l.trail !== null)
        .map(l => ({ who: l.who.trim(), upfront: l.upfront, trail: l.trail })),
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

  // REMOVE IS SAFE, AND I WAS WRONG TO LEAVE IT OUT.
  //
  // 27 Oct 2026. This shipped with "Stop using it" and nothing else, on the
  // reasoning that a deal which used an arrangement has to keep making sense.
  // Fabio, looking at two test rows he could not get rid of: "also you never
  // create deelte buttons see I cant delete them".
  //
  // He is right and the reasoning was wrong. A deal keeps its OWN COPY of the
  // whole arrangement the moment a broker picks it - the name, the kind and
  // every line, written onto the deal by chooseSplitPatch(). Deleting the row
  // here cannot change a single deal: the fact find dropdown already says "no
  // longer in use" for an arrangement that has gone, and termsHaveMoved()
  // already returns nothing when there is no row to compare against. I checked
  // all three before adding this.
  //
  // STOP USING IT STAYS, because the two are different answers. "We still have
  // this arrangement, just not on new deals" and "this was a mistake, bin it"
  // are both things somebody needs to be able to say.
  async function remove(r: Row) {
    setSaving(r.id); setErr('')
    const { data, error } = await supabase.from('commission_splits')
      .delete().eq('id', r.id).select('id')
    if (error || !data?.length) {
      setErr(error?.message || 'That was not removed — nothing reached the database.')
    } else {
      setRows(rs => rs.filter(x => x.id !== r.id))
    }
    setSaving(null); setConfirming(null)
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

            {/* ONE BOX ASKING "WHO", NOT TWO. There used to be a "Who, in
                person" line here as well as the table below, and two boxes
                asking the same question is how two answers end up disagreeing.
                The table says who. What was already typed in the old box is
                kept on the row and still reads correctly on older deals. */}
            <div className="flex gap-2 items-center flex-wrap mb-2">
              <input className={`${INP} flex-1 min-w-[180px]`} value={r.contactEmail}
                onChange={e => edit(r.id, { contactEmail: e.target.value })}
                placeholder="Email for the invoice (optional)" />
            </div>

            {/* WHO GETS WHAT. One line per party.
                27 Oct 2026. Fabio: "we need the ability of addint lines for
                upfront and trail so line one for exmaple 20% simplify line 80%
                broker 1 and abilty to add third line". One pair of percentages
                could only ever say what ONE party gets. */}
            <table className="w-full border-collapse mb-1">
              <thead>
                <tr>
                  <th className="text-left text-[9.5px] font-bold tracking-[.07em] uppercase text-faint pb-1.5 pr-2">Who gets a share</th>
                  <th className="text-right text-[9.5px] font-bold tracking-[.07em] uppercase text-faint pb-1.5 pr-2 w-[96px]">Upfront</th>
                  <th className="text-right text-[9.5px] font-bold tracking-[.07em] uppercase text-faint pb-1.5 pr-2 w-[96px]">Trail</th>
                  <th className="w-[26px]" />
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="pr-2 py-[3px]">
                      <input className={`${INP} w-full`} value={l.who} list="sf-share-names"
                        onChange={e => editLine(r.id, i, { who: e.target.value })}
                        placeholder="Simplify Finance, a referrer, a broker…" />
                    </td>
                    <td className="pr-2 py-[3px] text-right">
                      <input className={PCT} value={l.upfront === null ? '' : String(l.upfront)}
                        onChange={e => editLine(r.id, i, { upfront: readPct(e.target.value) })} placeholder="—" />
                      <span className="text-[12px] text-faint ml-1">%</span>
                    </td>
                    <td className="pr-2 py-[3px] text-right">
                      <input className={PCT} value={l.trail === null ? '' : String(l.trail)}
                        onChange={e => editLine(r.id, i, { trail: readPct(e.target.value) })} placeholder="—" />
                      <span className="text-[12px] text-faint ml-1">%</span>
                    </td>
                    <td className="text-center">
                      <button onClick={() => dropLine(r.id, i)} title="Take this line off"
                        className="text-faint text-[13px] hover:text-chase">&#10005;</button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-line-soft">
                  <td className="pt-2 text-[12.5px] font-semibold text-muted">Adds up to</td>
                  <td className={`pt-2 pr-2 text-right text-[12.5px] font-bold tabular-nums ${
                    totalsOf(r.lines).upfrontOk ? 'text-done' : 'text-chase'}`}>{totalsOf(r.lines).upfront}%</td>
                  <td className={`pt-2 pr-2 text-right text-[12.5px] font-bold tabular-nums ${
                    totalsOf(r.lines).trailOk ? 'text-done' : 'text-chase'}`}>{totalsOf(r.lines).trail}%</td>
                  <td />
                </tr>
              </tbody>
            </table>

            <button onClick={() => addLine(r.id)}
              className="text-[11.5px] font-semibold text-[#0E8FCB] bg-card border border-dashed border-[#BFE6F9] rounded-[9px] px-3 py-1.5 mt-1">
              + Add a line
            </button>

            {addsUpWarning(r.lines) && (
              <p className="mt-2 mb-0 text-[11.5px] text-chase bg-chase-bg border border-chase-edge rounded-[9px] px-3 py-1.5 leading-relaxed">
                {addsUpWarning(r.lines)}
              </p>
            )}

            <div className="flex gap-2 items-center flex-wrap mt-2">
              <input className={`${INP} flex-1 min-w-[160px]`} value={r.notes}
                onChange={e => edit(r.id, { notes: e.target.value })} placeholder="Notes" />
            </div>

            <div className="flex gap-2 items-center flex-wrap mt-2.5">
              <span className="text-[11.5px] text-muted flex-1">
                The broker sees: <b className="text-ink">{r.name || 'Unnamed'}</b> — {linesInWords(r.lines)}
              </span>
              {confirming === r.id ? (
                <span className="flex gap-1.5 items-center">
                  <span className="text-[11.5px] text-chase">
                    Remove {r.name || 'this arrangement'}? No deal that used it changes.
                  </span>
                  <button onClick={() => remove(r)} disabled={saving === r.id}
                    className="text-[11.5px] font-bold text-white bg-chase rounded-lg px-2.5 py-1">
                    {saving === r.id ? '…' : 'Remove'}
                  </button>
                  <button onClick={() => setConfirming(null)}
                    className="text-[11.5px] border border-card-line bg-card rounded-lg px-2.5 py-1 text-body">
                    Keep
                  </button>
                </span>
              ) : (
                <>
                  <button onClick={() => edit(r.id, { active: !r.active })}
                    className="text-[12px] border border-card-line bg-card rounded-lg px-3 py-1.5 text-body hover:bg-page">
                    {r.active ? 'Stop using it' : 'Use it again'}
                  </button>
                  <button onClick={() => setConfirming(r.id)}
                    className="text-[12px] text-faint border border-card-line bg-card rounded-lg px-3 py-1.5 hover:text-chase">
                    Remove
                  </button>
                  <button onClick={() => save(r)} disabled={!r.dirty || saving === r.id}
                    className="text-[12px] font-semibold text-[#0E8FCB] bg-card border border-[#BFE6F9] rounded-lg px-4 py-1.5 hover:bg-[#EAF7FE] disabled:opacity-40">
                    {saving === r.id ? 'Saving…' : r.dirty ? 'Save' : 'Saved'}
                  </button>
                </>
              )}
            </div>

            {!r.active && (
              <p className="text-[11px] text-faint mt-2 leading-relaxed">
                Not offered on new deals. Every deal that already used it is untouched and still reads correctly.
              </p>
            )}
          </div>
        ))}
      </div>

      <datalist id="sf-share-names">{names.map(n => <option key={n} value={n} />)}</datalist>

      <button onClick={add}
        className="text-[12.5px] font-semibold text-[#0E8FCB] bg-card border border-[#BFE6F9] rounded-lg px-4 py-2 mt-4 hover:bg-[#EAF7FE] transition">
        + Add a split
      </button>
    </div>
  )
}
