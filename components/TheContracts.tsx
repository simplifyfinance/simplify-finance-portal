'use client'
import { sendToBeRead, readAnswer } from '@/lib/send-a-document-to-be-read'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { withAnswer } from '@/lib/a-checked-row'
import { OFFICE } from '@/lib/same-date-everywhere'
import {
  checkContract, differences, countWords, askAbout, heldBack, holdWords,
  ANSWER_WORDS, type Answer, type Line,
} from '@/lib/the-contract-check'
import {
  formalSnapshot, expectedFromFormal, checkedAgainst, NO_FORMAL,
} from '@/lib/what-formal-approval-said'

// THE CONTRACTS, DROPPED AND CHECKED.
//
// 17 Nov 2026. Fabio: "if we drop the section, you don't have to save into the
// portal, but it's similar to bank statements. Once you drop it in there, it's
// analyzed and it sits the data, and it has the ability to load multiple
// contracts, and you'll confirm when we're sending the confirmation email that
// everything is correct."
//
// THE FILE IS NEVER SAVED. It is read on the way through and gone when the
// request returns. What it SAID is written onto the deal, with who dropped it
// and when - "we dont need to store the documents after reading but obviously
// we retain all data."
//
// EVERYTHING IS CHECKED AGAINST THE FORMAL APPROVAL. "everyhtig passes through
// formal." Where no formal approval has been recorded this says so rather than
// quietly measuring against something else.
//
// NOTHING IS CORRECTED AUTOMATICALLY. The portal says what differs. A person
// says which side is wrong, and that answer is recorded with their name on it.

const money = (v: any) => v

type Read = {
  at: string
  by: string
  lender: string
  reference: string
  loans: any[]
  /** Which side was believed, per loan index then field. */
  answers?: Record<string, Record<string, Answer>>
}

const when = (iso: string) => {
  const d = new Date(String(iso || ''))
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU',
    { timeZone: OFFICE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
const day = (iso: string) => {
  const d = new Date(String(iso || ''))
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU',
    { timeZone: OFFICE, day: 'numeric', month: 'short' })
}

export default function TheContracts({ deal, me, onSaved }: {
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

  // THE FORMAL APPROVAL SNAPSHOT. The one thing a contract is measured against.
  useEffect(() => {
    let alive = true
    supabase.from('deal_stage_snapshots').select('*').eq('deal_id', deal?.id)
      .then(({ data }: any) => { if (alive) setSnapRows(data || []) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id])

  const docs = (d?.settlement_documents && typeof d.settlement_documents === 'object')
    ? d.settlement_documents : {}
  const read: Read | null = docs.contracts || null
  const snap = formalSnapshot(snapRows)
  const expected = expectedFromFormal(d, snap)

  async function save(next: any) {
    setBusy(true); setMsg('')
    const patch = { settlement_documents: { ...docs, contracts: next } }
    const problem = await checkedWrite(
      supabase.from('deals').update(patch).eq('id', d.id), 'What the contract said')
    setBusy(false)
    if (problem) { setMsg(problem); return }
    setD({ ...d, ...patch })
    onSaved?.(patch)
  }

  async function drop(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true); setMsg('')
    const loans: any[] = []
    let lender = ''
    let reference = ''
    try {
      for (const file of Array.from(files)) {
      // HOWEVER BIG IT IS - 22 Nov 2026. Small files go as base64 exactly as
      // they always have; one too big for Vercel's 4.5 MB request body goes
      // into the reading room and only its path is posted. The answer is read
      // as text first, because a 413 is not JSON and res.json() on it is what
      // put "Unexpected token 'R'" in front of Belle.
      // See lib/send-a-document-to-be-read.ts.
      const sent = await sendToBeRead(file)
        const res = await fetch('/api/read-loan-contract', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sent.body),
        })
        const answer = await readAnswer(res)
        if (!answer.ok) { setMsg(answer.why); setBusy(false); return }
        const out = answer.out
        lender = lender || out.lender || ''
        reference = reference || out.reference || ''
        for (const l of out.loans || []) loans.push(l)
      }
    } catch (e: any) {
      setMsg(e?.message || 'That file could not be read.'); setBusy(false); return
    }
    setBusy(false)
    if (loans.length === 0) {
      setMsg('Nothing could be read from that. Nothing has been recorded against the deal.')
      return
    }
    // A NEW DROP REPLACES THE OLD READING, and the answers with it - they were
    // answers about figures that are no longer on screen.
    await save({ at: new Date().toISOString(), by: me?.name || '', lender, reference, loans, answers: {} })
  }


  const checks: Line[][] = (read?.loans || []).map((l, i) =>
    checkContract({
      rate: l.rate, repayment: l.repayment, ioTerm: l.ioTerm, amount: l.amount,
      loanTerm: l.loanTerm, security: l.security, borrowers: l.borrowers,
    }, expected[i] || {}))

  const stillOpen = checks.reduce((n, lines, i) =>
    n + heldBack(lines, (read?.answers || {})[String(i)] || {}).length, 0)

  return (
    <div className="px-4 pb-4">
      <div className="rounded-xl border-2 border-brand-ink bg-card px-4 py-3.5">
        <div className="mb-2 flex items-center gap-2.5 flex-wrap">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">
            Loan contracts
          </span>
          {read && (
            <span className="ml-auto text-[10.5px] font-bold text-faint">
              {read.loans.length} read &middot; {when(read.at)}{read.by ? ` · ${read.by}` : ''}
            </span>
          )}
        </div>

        {/* NO FORMAL APPROVAL, NOTHING TO CHECK AGAINST. It says so rather than
            measuring the contract against something else. */}
        {!snap && snapRows !== null && (
          <p className="mb-2 mt-0 rounded-[10px] border border-info-edge bg-info-bg px-3 py-2 text-[12.5px] text-info">
            {NO_FORMAL}
          </p>
        )}

        <label className="mb-3 block cursor-pointer rounded-[11px] border border-dashed border-field-line bg-page px-4 py-4 text-center">
          <input type="file" accept="application/pdf" multiple className="hidden"
            disabled={busy || !snap}
            onChange={e => { void drop(e.target.files); e.currentTarget.value = '' }} />
          <span className="block text-[13.5px] font-bold text-body">
            {busy ? 'Reading…' : 'Drop the loan contracts here'}
          </span>
          <span className="text-[12.5px] text-faint">
            As many as there are. They are read and checked, and the file is not kept.
          </span>
        </label>

        {read && checks.map((lines, i) => {
          const loan = read.loans[i] || {}
          const answers = (read.answers || {})[String(i)] || {}
          const diffs = differences(lines)
          return (
            <div key={i} className="mb-2.5 overflow-hidden rounded-[11px] border border-card-line last:mb-0">
              <div className="flex flex-wrap items-center gap-2.5 border-b border-card-line bg-page px-3 py-2">
                <span className="text-[13px] font-bold">{loan.label || `Loan ${i + 1}`}</span>
                <span className="text-[11.5px] text-faint">
                  {[read.lender, `contract ${i + 1} of ${read.loans.length}`].filter(Boolean).join(' · ')}
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
                          : l.state === 'differs' ? `the deal says ${l.expected}`
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

        {/* THE ONE THING IN THIS WHOLE BUILD THAT BLOCKS ANYTHING, and it
            blocks the one email that carries the figures. */}
        {read && (
          <div className="mt-3 rounded-[11px] border border-card-line border-l-[4px] border-l-ink bg-card px-3.5 py-2.5">
            {stillOpen > 0 ? (
              <>
                <div className="text-[13px] font-bold">{holdWords(stillOpen)}</div>
                <p className="m-0 text-[12.5px] text-body">
                  The loan documents email is held until every difference has been answered.
                </p>
              </>
            ) : (
              <div className="text-[13px] font-bold">
                Everything is confirmed. The loan documents email can go.
              </div>
            )}
            <p className="m-0 mt-1.5 text-[11.5px] text-faint">
              {checkedAgainst(d, day)} The file itself was not kept.
            </p>
          </div>
        )}

        {msg && <p className="mt-2 mb-0 text-[12.5px] text-chase">{msg}</p>}
      </div>
    </div>
  )
}
