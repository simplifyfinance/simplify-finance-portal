'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  RULES, rulesOf, answerTo, optionLabel, rememberedLine, type LenderRule,
} from '@/lib/lender-rules'
import { dayMonth } from '@/lib/same-date-everywhere'

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

  if (loading) return <p className="text-[13px] text-[#A29889]">Loading what the portal has learned…</p>

  return (
    <div>
      <p className="text-[12.5px] text-[#6E665C] mb-4 max-w-[86ch]">
        Each of these is asked once, the first time a template needs it, and remembered against the
        lender from then on. <b>Blank means nobody has answered</b> — the portal asks rather than
        guessing, because a confident wrong sentence on a client email is worse than a question.
      </p>

      {err && (
        <p className="mb-3 border border-[#E9D2CF] bg-[#FDF3F2] rounded-lg px-3 py-2 text-[12.5px] text-[#8E3A34]">{err}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="text-left text-[9.5px] uppercase tracking-[.06em] text-[#98A1AB] font-bold py-2 pr-3 border-b border-[#EEF0F2]">Lender</th>
              {RULES.map(q => (
                <th key={q.key} title={q.ask}
                  className="text-left text-[9.5px] uppercase tracking-[.06em] text-[#98A1AB] font-bold py-2 pr-3 border-b border-[#EEF0F2]">
                  {q.short}
                </th>
              ))}
              <th className="text-left text-[9.5px] uppercase tracking-[.06em] text-[#98A1AB] font-bold py-2 border-b border-[#EEF0F2]">Reprice</th>
            </tr>
          </thead>
          <tbody>
            {lenders.map(l => (
              <tr key={l.id}>
                <td className="py-2 pr-3 border-b border-[#EEF0F2] font-semibold text-[#221F1B] align-top">{l.name}</td>
                {RULES.map(q => {
                  const mine = rules[l.id] || {}
                  const v = answerTo(mine, q.key)
                  return (
                    <td key={q.key} className="py-2 pr-3 border-b border-[#EEF0F2] align-top">
                      <select value={v} onChange={e => setAnswer(l.id, q.key, e.target.value)}
                        aria-label={`${l.name} — ${q.ask}`}
                        className={`text-[12px] border rounded-md px-1.5 py-1 bg-white max-w-[170px] ${
                          v ? 'border-[#BBE7CF] text-[#0F7B4F] font-semibold' : 'border-[#EBD9BE] text-[#8A6218]'}`}>
                        <option value="">not recorded</option>
                        {q.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {v && mine[q.key]?.setBy && (
                        <div className="text-[10px] text-[#C3BDB2] mt-[3px] leading-tight">
                          {mine[q.key].setBy}
                          {mine[q.key].setAt ? ` · ${dayMonth(mine[q.key].setAt)}` : ''}
                          {mine[q.key].used > 0 ? ` · ${mine[q.key].used} deal${mine[q.key].used === 1 ? '' : 's'}` : ''}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="py-2 border-b border-[#EEF0F2] align-top text-[#5B6672]">
                  {l.reprice_over_percent === null
                    ? <span className="text-[#C3BDB2]">N/A</span>
                    : `${l.reprice_over_percent}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11.5px] text-[#A29889] mt-4 max-w-[86ch]">
        Changing an answer here changes it for every deal with that lender from now on. To change one
        deal without changing the rule, do it on the send screen — it asks which you mean.
      </p>
    </div>
  )
}
