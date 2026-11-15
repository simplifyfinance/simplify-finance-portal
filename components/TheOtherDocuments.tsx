'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { OFFICE } from '@/lib/same-date-everywhere'
import { STEPS, stepOf, type Step } from '@/lib/the-seven-steps'
import { securitiesOf } from '@/lib/box-security'
import { settlementDate } from '@/lib/settlement'
import { recommendedOption } from '@/lib/recommended-option'
import { hasOffset } from '@/lib/offset'
import { borrowersOf } from '@/lib/what-formal-approval-said'
import {
  differences, heldBack, countWords, holdWords, answerWords, type Answer, type Row,
} from '@/lib/a-checked-row'
import { checkSignedDocuments, askAboutSigned } from '@/lib/the-signed-documents-check'
import {
  checkInsurance, askAboutInsurance, securityFor,
} from '@/lib/the-insurance-check'
import { certificateFor, certificateWhy, CERTIFICATE_LABEL } from '@/lib/which-insurance-certificate'

// THE OTHER TWO DOCUMENTS.
//
// 17 Nov 2026. The loan contract is checked against the formal approval. These
// two are not comparisons at all - they are completeness checks, and what is
// MISSING is the finding. An unsigned page is not an absence of information.
//
// They sit on the deal at the step they actually arrive at, and stay visible
// afterwards because somebody looking at a booked settlement still wants to see
// what the certificate said.
//
// THE FILE IS NOT KEPT, the same as the contracts. It is read on the way
// through and gone when the request returns. What it SAID is written onto the
// deal with who dropped it and when.
//
// NOTHING IS CORRECTED AUTOMATICALLY. The portal says what is missing. A person
// says what to do about it, and that answer carries their name.

type Read = {
  at: string
  by: string
  read: any
  answers?: Record<string, Answer>
}

const when = (iso: string) => {
  const d = new Date(String(iso || ''))
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU',
    { timeZone: OFFICE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** True once the deal has reached this step, and from then on. */
function reached(deal: any, step: Step): boolean {
  const now = stepOf(deal)
  if (!now) return false
  return STEPS.indexOf(now) >= STEPS.indexOf(step)
}

function Box({
  title, note, hint, saved, rows, ask, noun, busy, msg, onDrop, onAnswer,
}: {
  title: string
  note?: string
  hint: string
  saved: Read | null
  rows: Row[]
  ask: (r: Row) => string
  noun: string
  busy: boolean
  msg: string
  onDrop: (files: FileList | null) => void
  onAnswer: (field: string, a: Answer) => void
}) {
  const words = answerWords(noun)
  const answers = saved?.answers || {}
  const diffs = differences(rows)
  const open = heldBack(rows, answers).length

  return (
    <div className="px-4 pb-4">
      <div className="rounded-xl border-2 border-brand-ink bg-card px-4 py-3.5">
        <div className="mb-2 flex items-center gap-2.5 flex-wrap">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">
            {title}
          </span>
          {note && <span className="text-[11px] font-bold text-faint">{note}</span>}
          {saved && (
            <span className="ml-auto text-[10.5px] font-bold text-faint">
              {when(saved.at)}{saved.by ? ` · ${saved.by}` : ''}
            </span>
          )}
        </div>

        <label className="mb-3 block cursor-pointer rounded-[11px] border border-dashed border-field-line bg-page px-4 py-4 text-center">
          <input type="file" accept="application/pdf" className="hidden" disabled={busy}
            onChange={e => { onDrop(e.target.files); e.currentTarget.value = '' }} />
          <span className="block text-[13.5px] font-bold text-body">
            {busy ? 'Reading…' : saved ? 'Drop a newer one here' : `Drop the ${title.toLowerCase()} here`}
          </span>
          <span className="text-[12.5px] text-faint">{hint}</span>
        </label>

        {saved && rows.length > 0 && (
          <div className="overflow-hidden rounded-[11px] border border-card-line">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-card-line bg-page px-3 py-2">
              <span className="text-[13px] font-bold">{title}</span>
              <span className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-[2px] text-[11px] font-bold ${
                diffs.length ? 'bg-brand-ink text-page' : 'bg-line-soft text-muted'}`}>
                {countWords(rows)}
              </span>
            </div>

            <table className="w-full border-collapse text-[13.5px]">
              <tbody>
                {rows.map(r => (
                  <tr key={r.field}>
                    <td className="w-[150px] border-t border-line-soft px-3 py-2 align-top text-[12.5px] text-muted">
                      {r.label}
                    </td>
                    <td className={`border-t border-line-soft px-3 py-2 align-top font-semibold ${
                      r.state === 'differs' ? 'text-brand-ink' : ''}`}>
                      {r.says || <span className="font-normal text-faint">not stated</span>}
                    </td>
                    <td className={`w-[240px] border-t border-line-soft px-3 py-2 align-top text-[12.5px] ${
                      r.state === 'differs' ? 'text-body' : 'text-faint'}`}>
                      {r.state === 'matches' ? 'present'
                        : r.expected ? r.expected : 'nobody has recorded it'}
                    </td>
                    <td className={`w-[30px] border-t border-line-soft px-3 py-2 text-center align-top ${
                      r.state === 'differs' ? 'font-extrabold text-brand-ink' : 'text-faint'}`}>
                      {r.state === 'differs' ? '≠' : r.state === 'matches' ? '✓' : '·'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {diffs.map(r => (
              <div key={r.field} className="border-t border-info-edge bg-info-bg px-3 py-2.5">
                <div className="mb-2 text-[13px] text-body">{ask(r)}</div>
                <div className="flex flex-wrap gap-2">
                  {(['contract', 'deal', 'unsure'] as Answer[]).map(a => {
                    const on = answers[r.field] === a
                    return (
                      <button key={a} type="button" disabled={busy}
                        onClick={() => onAnswer(r.field, a)}
                        className={`rounded-[9px] border px-3 py-1.5 text-[12.5px] font-semibold ${
                          on ? 'border-ink bg-ink text-page' : 'border-field-line bg-card'}`}>
                        {words[a]}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* IT HOLDS NOTHING. Only the loan contract holds an email, because only
            that email carries the figures. This counts so somebody can see the
            size of the job, and says plainly that it is not a blocker. */}
        {saved && open > 0 && (
          <p className="mb-0 mt-2.5 text-[12.5px] text-body">
            <span className="font-bold">{holdWords(open).replace(' before the client is told', '')}</span>
            {' '}— nothing is held up by this.
          </p>
        )}
        {saved && open === 0 && diffs.length === 0 && rows.length > 0 && (
          <p className="mb-0 mt-2.5 text-[12.5px] text-faint">
            Nothing outstanding on this document. The file itself was not kept.
          </p>
        )}

        {msg && <p className="mt-2 mb-0 text-[12.5px] text-chase">{msg}</p>}
      </div>
    </div>
  )
}

export default function TheOtherDocuments({ deal, me, onSaved }: {
  deal: any
  me?: { id?: string | null; name?: string | null }
  onSaved?: (patch: Record<string, any>) => void
}) {
  const supabase = createSupabaseBrowser()
  const [d, setD] = useState<any>(deal)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<Record<string, string>>({})

  useEffect(() => { setD(deal) }, [deal])

  const docs = (d?.settlement_documents && typeof d.settlement_documents === 'object')
    ? d.settlement_documents : {}
  const signed: Read | null = docs.signed || null
  const insurance: Read | null = docs.insurance || null

  async function save(key: string, next: any) {
    const patch = { settlement_documents: { ...docs, [key]: next } }
    const problem = await checkedWrite(
      supabase.from('deals').update(patch).eq('id', d.id), 'What the document said')
    if (problem) { setMsg(m => ({ ...m, [key]: problem })); return }
    setD({ ...d, ...patch })
    onSaved?.(patch)
  }

  async function drop(key: 'signed' | 'insurance', files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setBusy(key); setMsg(m => ({ ...m, [key]: '' }))
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve((r.result as string).split(',')[1])
        r.onerror = () => reject(new Error('That file could not be opened.'))
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/read-settlement-document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, kind: key }),
      })
      const out = await res.json()
      if (!res.ok) { setMsg(m => ({ ...m, [key]: out?.error || 'That could not be read.' })); return }
      // A NEW DROP CLEARS THE ANSWERS - they were about a document that is no
      // longer on screen.
      await save(key, { at: new Date().toISOString(), by: me?.name || '', read: out.read || {}, answers: {} })
    } catch (e: any) {
      setMsg(m => ({ ...m, [key]: e?.message || 'That file could not be read.' }))
    } finally {
      setBusy('')
    }
  }

  async function answer(key: 'signed' | 'insurance', saved: Read | null, field: string, a: Answer) {
    if (!saved) return
    await save(key, { ...saved, answers: { ...(saved.answers || {}), [field]: a } })
  }

  // WHAT THE DEAL SAYS EACH DOCUMENT SHOULD SHOW.
  const option = recommendedOption(d?.lo_data || {})
  const signedRows = signed
    ? checkSignedDocuments(signed.read || {}, {
        borrowers: borrowersOf(d),
        hasOffset: hasOffset(option?.offsetAccount),
      })
    : []

  const securities = securitiesOf(d).map(s => ({ address: s.address, subtype: s.subtype }))
  const about = securityFor(securities, insurance?.read?.insured)
  const needs = certificateFor(about?.subtype)
  const insuranceRows = insurance
    ? checkInsurance(insurance.read || {}, {
        security: about?.address || '',
        lender: option?.lenderName || '',
        settlesOn: settlementDate(d) || '',
        needs,
      })
    : []

  const showSigned = reached(d, 'contracts_reviewing') || !!signed
  const showInsurance = (reached(d, 'outstandings') || !!insurance) && needs !== 'none'

  return (
    <>
      {showSigned && (
        <Box
          title="Signed loan documents"
          hint="One pack. It is read and checked, and the file is not kept."
          saved={signed} rows={signedRows} ask={askAboutSigned} noun="pack"
          busy={busy === 'signed'} msg={msg.signed || ''}
          onDrop={f => void drop('signed', f)}
          onAnswer={(field, a) => void answer('signed', signed, field, a)}
        />
      )}
      {showInsurance && (
        <Box
          title={CERTIFICATE_LABEL[needs]}
          note={about?.subtype ? certificateWhy(about.subtype) : undefined}
          hint="The certificate of currency. It is read and checked, and the file is not kept."
          saved={insurance} rows={insuranceRows} ask={askAboutInsurance} noun="certificate"
          busy={busy === 'insurance'} msg={msg.insurance || ''}
          onDrop={f => void drop('insurance', f)}
          onAnswer={(field, a) => void answer('insurance', insurance, field, a)}
        />
      )}
    </>
  )
}
