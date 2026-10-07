'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  RULES, rulesOf, answerTo, optionLabel, rememberedLine, isTyped, type LenderRule,
} from '@/lib/lender-rules'
import { dayMonth } from '@/lib/same-date-everywhere'
import { useBusyWhile } from '@/components/useBusy'
import { SkelPanel } from '@/components/Skeleton'

// WHAT THE PORTAL HAS LEARNED ABOUT EACH LENDER.
//
// Fabio, 29 Sep 2026: "lets build a rules based on each ledner to learn as we
// seelct if preapprovalc na extended etc".
//
// The answers are learned on the send screen, one at a time, the first time a
// template needs one. This page exists so they are VISIBLE - a rule nobody can
// see is a rule nobody can correct, and the repricing threshold taught us that a
// number with no name behind it gets argued about instead of fixed.
//
// Everything here is editable without a deploy. That is the whole point of the
// questions living in lib/lender-rules.ts and the answers living in a table.
//
// NOT RECORDED IS SHOWN, NOT HIDDEN. A blank cell says "not recorded" in amber
// rather than being left empty, because an empty cell reads as "no" and "no" is
// an answer nobody gave.

type Row = { id: string; name: string; reprice_over_percent: number | null }

export default function LenderRules() {
  const supabase = createSupabaseBrowser()
  const [lenders, setLenders] = useState<Row[]>([])
  const [rules, setRules] = useState<Record<string, Record<string, LenderRule>>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [me, setMe] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: ls, error: le }, { data: rs, error: re }, { data: auth }] = await Promise.all([
        supabase.from('lenders').select('id, name, reprice_over_percent').order('name'),
        supabase.from('lender_rules').select('lender_id, key, value, set_by, set_at, used'),
        supabase.auth.getUser(),
      ])
      if (!alive) return
      if (le || re) { setErr((le || re)!.message); setLoading(false); return }
      setLenders((ls || []) as Row[])
      const byLender: Record<string, any[]> = {}
      for (const r of rs || []) (byLender[(r as any).lender_id] ||= []).push(r)
      const out: Record<string, Record<string, LenderRule>> = {}
      for (const [id, rows] of Object.entries(byLender)) out[id] = rulesOf(rows)
      setRules(out)
      setMe(String(auth?.user?.email || ''))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  async function setAnswer(lenderId: string, key: string, value: string) {
    setErr('')
    const prev = rules[lenderId]?.[key]
    // Optimistic, so a dropdown does not jump back while the round trip runs.
    setRules(r => ({ ...r, [lenderId]: { ...(r[lenderId] || {}),
      [key]: { key, value, setBy: me, setAt: new Date().toISOString(), used: prev?.used || 0 } } }))
    const { data: rows, error } = await supabase.from('lender_rules')
      .upsert({ lender_id: lenderId, key, value, set_by: me, set_at: new Date().toISOString() },
              { onConflict: 'lender_id,key' })
      .select('key')
    // Zero rows with no error means the write was refused. Never fail silently,
    // and never leave the screen claiming something the database did not take.
    if (error || !rows?.length) {
      setErr(error ? `Not saved: ${error.message}` : 'Not saved — nothing was written. Please tell Fabio.')
      setRules(r => {
        const copy = { ...(r[lenderId] || {}) }
        if (prev) copy[key] = prev; else delete copy[key]
        return { ...r, [lenderId]: copy }
      })
    }
  }

  useBusyWhile(loading)
  if (loading) return (
    <div className="space-y-3" aria-busy="true">
      <SkelPanel lines={4} />
      <SkelPanel lines={4} />
      <SkelPanel lines={4} />
    </div>
  )



  return (
    <div>
      <p className="text-[12.5px] text-muted mb-4 max-w-[86ch]">
        Each of these is asked once, the first time a template needs it, and remembered against the
        lender from then on. <b>Blank means nobody has answered</b> — the portal asks rather than
        guessing, because a confident wrong sentence on a client email is worse than a question.
      </p>

      {err && (
        <p className="mb-3 border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12.5px] text-chase">{err}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="text-left text-[9.5px] uppercase tracking-[.06em] text-faint font-bold py-2 pr-3 border-b border-line-soft">Lender</th>
              {RULES.map(q => (
                <th key={q.key} title={q.ask}
                  className="text-left text-[9.5px] uppercase tracking-[.06em] text-faint font-bold py-2 pr-3 border-b border-line-soft">
                  {q.short}
                </th>
              ))}
              <th className="text-left text-[9.5px] uppercase tracking-[.06em] text-faint font-bold py-2 border-b border-line-soft">Reprice</th>
            </tr>
          </thead>
          <tbody>
            {lenders.map(l => (
              <tr key={l.id}>
                <td className="py-2 pr-3 border-b border-line-soft font-semibold text-ink align-top">{l.name}</td>
                {RULES.map(q => {
                  const mine = rules[l.id] || {}
                  const v = answerTo(mine, q.key)
                  return (
                    <td key={q.key} className="py-2 pr-3 border-b border-line-soft align-top">
                      {/* A TYPED ANSWER GETS A BOX, NOT A DROPDOWN. No list of
                          options could hold what each bank wants to be called on
                          an insurance certificate. Saved when you leave the box
                          or press Enter - never on every keystroke, which would
                          write a row per letter typed. */}
                      {isTyped(q.key) ? (
                        <TypedCell value={v} lender={l.name} ask={q.ask}
                          onSave={next => { if (next !== v) setAnswer(l.id, q.key, next) }} />
                      ) : (
                      <select value={v} onChange={e => setAnswer(l.id, q.key, e.target.value)}
                        aria-label={`${l.name} — ${q.ask}`}
                        className={`text-[12px] border rounded-md px-1.5 py-1 bg-card max-w-[170px] ${
                          v ? 'border-done-edge text-done font-semibold' : 'border-dashed border-field-line text-muted'}`}>
                        <option value="">not recorded</option>
                        {q.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      )}
                      {v && mine[q.key]?.setBy && (
                        <div className="text-[10px] text-faint mt-[3px] leading-tight">
                          {mine[q.key].setBy}
                          {mine[q.key].setAt ? ` · ${dayMonth(mine[q.key].setAt)}` : ''}
                          {mine[q.key].used > 0 ? ` · ${mine[q.key].used} deal${mine[q.key].used === 1 ? '' : 's'}` : ''}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="py-2 border-b border-line-soft align-top text-muted">
                  {l.reprice_over_percent === null
                    ? <span className="text-faint">N/A</span>
                    : `${l.reprice_over_percent}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11.5px] text-faint mt-4 max-w-[86ch]">
        Changing an answer here changes it for every deal with that lender from now on. To change one
        deal without changing the rule, do it on the send screen — it asks which you mean.
      </p>
    </div>
  )
}

// ONE CELL YOU TYPE INTO.
//
// Kept apart from the table so it can hold a draft of its own. A cell bound
// straight to the saved value would write a row every time somebody pressed a
// key, and 52 writes to record "Bankwest, a division of Commonwealth Bank of
// Australia" is 51 more than anybody wants in an audit trail.
function TypedCell({ value, lender, ask, onSave }: {
  value: string
  lender: string
  ask: string
  onSave: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  // Somebody else changing it elsewhere still wins while this box is untouched.
  useEffect(() => { setDraft(value) }, [value])

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onSave(draft.trim())}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      aria-label={`${lender} — ${ask}`}
      placeholder="not recorded"
      title={draft || ask}
      className={`text-[12px] border rounded-md px-1.5 py-1 bg-card w-[230px] ${
        draft.trim()
          ? 'border-done-edge text-done font-semibold'
          : 'border-dashed border-field-line text-muted placeholder:text-muted'}`}
    />
  )
}
