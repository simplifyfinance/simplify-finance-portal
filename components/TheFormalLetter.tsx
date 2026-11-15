'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { withAnswer } from '@/lib/a-checked-row'
import { OFFICE } from '@/lib/same-date-everywhere'
import { sameLenderName } from '@/lib/an-internal-refinance'
import {
  checkContract, askAbout, ANSWER_WORDS, type Line,
} from '@/lib/the-contract-check'
import { differences, heldBack, countWords, type Answer } from '@/lib/a-checked-row'
import { formalSnapshot, expectedFromFormal, NO_FORMAL } from '@/lib/what-formal-approval-said'
import { REFRESH_AT_FORMAL, lenderLine } from '@/lib/the-letter-is-the-banks-word'

// THE FORMAL APPROVAL LETTER.
//
// The fourth document, and the first one chronologically. It is dropped at
// Formal and it is the reason the other three can be trusted.
//
// BELLE, 14 Nov 2026: "Handover and broker notes: to be updated once loan hits
// formal as we will always base our checking with rates, amounts here — and
// mostly I've noticed that these details are often incorrect."
//
// That is the whole problem in one sentence. Every later check in this build
// compares what arrived against what was recorded at formal approval. If what
// was recorded at formal approval is wrong, the portal spends the next three
// weeks flagging the bank for being right, and the team stops reading the
// flags inside a week.
//
// So this runs FIRST, against the same snapshot, and it is the bank's own
// letter on the other side of the comparison.
//
// IT CHANGES NOTHING BY ITSELF. Where the letter and the deal disagree, the
// deal is almost always the one that is wrong - but putting the letter's
// figures into the deal automatically would overwrite a snapshot that three
// other checks are measured against, from a PDF, with nobody's name on it.
// Re-marking the deal formally approved already rewrites that snapshot from the
// deal, so the screen says to do that, in those words. See REFRESH_AT_FORMAL.

type Read = {
  at: string
  by: string
  lender: string
  reference: string
  loans: any[]
  answers?: Record<string, Record<string, Answer>>
}

const when = (iso: string) => {
  const d = new Date(String(iso || ''))
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU',
    { timeZone: OFFICE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function TheFormalLetter({ deal, me, onSaved }: {
  deal: any
  me?: { id?: string | null; name?: string | null }
  onSaved?: (patch: Record<string, any>) => void
}) {
  const supabase = createSupabaseBrowser()
  const [d, setD] = useState<any>(deal)
  const [snapRows, setSnapRows] = useState<any[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { setD(deal) }, [deal])

  useEffect(() => {
    let alive = true
    supabase.from('deal_stage_snapshots').select('*').eq('deal_id', deal?.id)
      .then(({ data }: any) => { if (alive) setSnapRows(data || []) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id])

  const docs = (d?.settlement_documents && typeof d.settlement_documents === 'object')
    ? d.settlement_documents : {}
  const read: Read | null = docs.formal_letter || null
  const snap = formalSnapshot(snapRows)
  const expected = expectedFromFormal(d, snap)

  async function save(next: any) {
    const patch = { settlement_documents: { ...docs, formal_letter: next } }
    const problem = await checkedWrite(
      supabase.from('deals').update(patch).eq('id', d.id), 'What the approval letter said')
    if (problem) { setMsg(problem); return }
    setD({ ...d, ...patch })
    onSaved?.(patch)
  }

  async function drop(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setBusy(true); setMsg('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve((r.result as string).split(',')[1])
        r.onerror = () => reject(new Error('That file could not be opened.'))
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/read-settlement-document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, kind: 'formal_letter' }),
      })
      const out = await res.json()
      if (!res.ok) { setMsg(out?.error || 'The letter could not be read.'); return }
      const r = out.read || {}
      if (!Array.isArray(r.loans) || r.loans.length === 0) {
        setMsg('Nothing could be read from that. Nothing has been recorded against the deal.')
        return
      }
      await save({
        at: new Date().toISOString(), by: me?.name || '',
        lender: r.lender || '', reference: r.reference || '', loans: r.loans, answers: {},
      })
    } catch (e: any) {
      setMsg(e?.message || 'That file could not be read.')
    } finally {
      setBusy(false)
    }
  }


  const checks: Line[][] = (read?.loans || []).map((l, i) =>
    checkContract({
      rate: l.rate, repayment: l.repayment, ioTerm: l.ioTerm, amount: l.amount,
      loanTerm: l.loanTerm, security: l.security, borrowers: l.borrowers,
    }, expected[i] || {}))

  const open = checks.reduce((n, lines, i) =>
    n + heldBack(lines, (read?.answers || {})[String(i)] || {}).length, 0)

  const lenderDiffers = !!read && !!snap?.lender && !!read.lender
    && !sameLenderName(read.lender, snap.lender)

  return (
    <div className="px-4 pb-4">
      <div className="rounded-xl border-2 border-brand-ink bg-card px-4 py-3.5">
        <div className="mb-2 flex items-center gap-2.5 flex-wrap">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">
            Formal approval letter
          </span>
          {read && (
            <span className="ml-auto text-[10.5px] font-bold text-faint">
              {read.loans.length} read &middot; {when(read.at)}{read.by ? ` · ${read.by}` : ''}
            </span>
          )}
        </div>

        {!snap && snapRows !== null && (
          <p className="mb-2 mt-0 rounded-[10px] border border-info-edge bg-info-bg px-3 py-2 text-[12.5px] text-info">
            {NO_FORMAL}
          </p>
        )}

        <label className="mb-3 block cursor-pointer rounded-[11px] border border-dashed border-field-line bg-page px-4 py-4 text-center">
          <input type="file" accept="application/pdf" className="hidden"
            disabled={busy || !snap}
            onChange={e => { void drop(e.target.files); e.currentTarget.value = '' }} />
          <span className="block text-[13.5px] font-bold text-body">
            {busy ? 'Reading…' : read ? 'Drop a newer letter here' : 'Drop the approval letter here'}
          </span>
          <span className="text-[12.5px] text-faint">
            It is read and checked against what the deal recorded at formal approval. The file is not kept.
          </span>
        </label>

        {read && lenderDiffers && (
          <p className="mb-2.5 mt-0 rounded-[10px] border border-info-edge bg-info-bg px-3 py-2 text-[13px] text-body">
            {lenderLine(read.lender, snap?.lender)}
          </p>
        )}

        {read && checks.map((lines, i) => {
          const loan = read.loans[i] || {}
          const answers = (read.answers || {})[String(i)] || {}
          const diffs = differences(lines)
          return (
            <div key={i} className="mb-2.5 overflow-hidden rounded-[11px] border border-card-line last:mb-0">
              <div className="flex flex-wrap items-center gap-2.5 border-b border-card-line bg-page px-3 py-2">
                <span className="text-[13px] font-bold">{loan.label || `Loan ${i + 1}`}</span>
                <span className="text-[11.5px] text-faint">
                  {[read.lender, read.reference].filter(Boolean).join(' · ')}
                </span>
                <span className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-[2px] text-[11px] font-bold ${
                  diffs.length ? 'bg-brand-ink text-page' : 'bg-line-soft text-muted'}`}>
                  {countWords(lines)}
                </span>
              </div>

              <table className="w-full border-collapse text-[13.5px]">
                <tbody>
                  {lines.map(l => (
                    <tr key={l.field}>
                      <td className="w-[150px] border-t border-line-soft px-3 py-2 align-top text-[12.5px] text-muted">
                        {l.label}
                      </td>
                      <td className={`border-t border-line-soft px-3 py-2 align-top font-semibold ${
                        l.state === 'differs' ? 'text-brand-ink' : ''}`}>
                        {l.says || <span className="font-normal text-faint">not stated</span>}
                      </td>
                      <td className={`w-[240px] border-t border-line-soft px-3 py-2 align-top text-[12.5px] ${
                        l.state === 'differs' ? 'text-body' : 'text-faint'}`}>
                        {l.state === 'matches' ? 'matches'
                          : l.expected ? `the deal says ${l.expected}` : 'nobody has recorded it'}
                      </td>
                      <td className={`w-[30px] border-t border-line-soft px-3 py-2 text-center align-top ${
                        l.state === 'differs' ? 'font-extrabold text-brand-ink' : 'text-faint'}`}>
                        {l.state === 'differs' ? '≠' : l.state === 'matches' ? '✓' : '·'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {diffs.map(l => (
                <div key={l.field} className="border-t border-info-edge bg-info-bg px-3 py-2.5">
                  <div className="mb-2 text-[13px] text-body">{askAbout(l)}</div>
                  <div className="flex flex-wrap gap-2">
                    {(['contract', 'deal', 'unsure'] as Answer[]).map(a => {
                      const on = answers[l.field] === a
                      return (
                        <button key={a} type="button" disabled={busy}
                          onClick={() => void save(withAnswer(read, i, l.field, a))}
                          className={`rounded-[9px] border px-3 py-1.5 text-[12.5px] font-semibold ${
                            on ? 'border-ink bg-ink text-page' : 'border-field-line bg-card'}`}>
                          {ANSWER_WORDS[a]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {/* THE ONE INSTRUCTION ON THIS SCREEN. Nothing is rewritten from a PDF.
            Re-marking the deal formally approved rewrites the snapshot from the
            deal, which is the existing door and has a person's name on it. */}
        {read && open > 0 && (
          <div className="mt-3 rounded-[11px] border border-card-line border-l-[4px] border-l-ink bg-card px-3.5 py-2.5">
            <div className="text-[13px] font-bold">
              {open === 1 ? 'One figure to settle before the contracts arrive'
                : `${open} figures to settle before the contracts arrive`}
            </div>
            <p className="m-0 text-[12.5px] text-body">{REFRESH_AT_FORMAL}</p>
          </div>
        )}
        {read && open === 0 && (
          <p className="mt-2.5 mb-0 text-[12.5px] text-faint">
            The letter agrees with the deal. Everything that arrives from here is checked against it.
          </p>
        )}

        {msg && <p className="mt-2 mb-0 text-[12.5px] text-chase">{msg}</p>}
      </div>
    </div>
  )
}
