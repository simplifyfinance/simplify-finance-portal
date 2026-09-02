'use client'
import { useState } from 'react'
import { type Finding, preflightHeadline } from '@/lib/preflight'
import { COMMISSION_LABEL, ID_METHOD_LABEL, ID_SERVICE_LABEL, missingAnswers,
         isRefinanceDeal, isInvestmentPurchase,
         type PushAnswers, type LiabilityChoice, type Commission, type IdMethod, type IdService }
  from '@/lib/push-answers'

// The two things that stand between finishing compliance and pushing a deal to
// SalesTrekker: what the file still needs checking for, and what credit needs to
// be told. Both are module-level components on purpose - a component declared
// inside another one is a new type on every render, so React unmounts and
// remounts it and every input loses focus mid-word. That has bitten this
// codebase twice.

const seg = 'text-[12.5px] px-3 py-1.5 transition'
const on = 'bg-[#343333] text-white font-semibold'
const off = 'text-[#8a9099] hover:bg-gray-50'
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]'
const lab = 'text-[11px] text-[#9aa0a6] block mb-1'

function Choice<T extends string>({ options, value, onChange }: {
  options: [T, string][]; value: T | undefined; onChange: (v: T) => void
}) {
  return (
    <span className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
      {options.map(([v, label], i) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`${seg} ${i ? 'border-l border-gray-200' : ''} ${value === v ? on : off}`}>
          {label}
        </button>
      ))}
    </span>
  )
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#F0F2F4] px-5 py-4">
      <div className="text-[10.5px] font-bold tracking-[.11em] uppercase text-[#9aa0a6] mb-1">{title}</div>
      {note && <div className="text-[11.5px] text-[#a3aab0] mb-2.5">{note}</div>}
      <div className={note ? '' : 'mt-2.5'}>{children}</div>
    </div>
  )
}

// --- what to check before the handover prints --------------------------------

const TONE: Record<string, { chip: string; box: string; text: string }> = {
  stop: { chip: 'text-[#8A3A3A] border-[#F5C2C2]', box: 'border-[#F5C2C2] bg-[#FDF0EF]', text: 'text-[#8A3A3A]' },
  warn: { chip: 'text-[#8A6218] border-[#EBD9BE]', box: 'border-[#EBD9BE] bg-[#FDF6EC]', text: 'text-[#8A6218]' },
}
const KIND_LABEL: Record<string, string> = {
  pronoun: 'One person?', placeholder: 'Placeholder', hem: 'HEM', title: 'Title', risks: 'Risks',
}

function highlight(snippet: string, words: string[] = []) {
  if (!snippet) return null
  const safe = words.filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (safe.length === 0) return <>{snippet}</>
  const parts = snippet.split(new RegExp(`(${safe.join('|')})`, 'gi'))
  return <>{parts.map((p, i) =>
    safe.some(w => new RegExp(`^${w}$`, 'i').test(p))
      ? <mark key={i} className="bg-[#FDE9C8] rounded-sm px-0.5">{p}</mark>
      : <span key={i}>{p}</span>
  )}</>
}

export function PreflightPanel({ findings, dealName, onOpen, onProceed, onCancel, onFix }: {
  findings: Finding[]
  dealName: string
  onOpen: (box: string) => void
  onProceed: () => void
  onCancel: () => void
  // Settles a finding here rather than sending somebody to another tab to tick
  // a box and start the push again.
  onFix?: (fix: NonNullable<Finding['fix']>) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-6 overflow-y-auto" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-[820px] max-w-full shadow-2xl mt-10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4">
          <div className="text-[16.5px] font-bold text-[#111]">{preflightHeadline(findings)}</div>
          <div className="text-[12.5px] text-[#7b828a] mt-1">
            {dealName} · nothing is blocked, but a handover is copied word for word into SalesTrekker — a wrong name is copied too.
          </div>
        </div>
        <div className="px-5 pb-2 max-h-[52vh] overflow-y-auto">
          {findings.map((f, i) => {
            const t = TONE[f.severity] || TONE.warn
            return (
              <div key={i} className={`border rounded-xl px-3.5 py-3 mb-2 ${t.box}`}>
                <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                  <span className={`text-[9.5px] font-extrabold tracking-[.07em] uppercase border rounded px-1.5 py-[1px] ${t.chip}`}>
                    {KIND_LABEL[f.kind] || f.kind}
                  </span>
                  <span className="text-[12.5px] font-bold text-[#222]">{f.box}</span>
                  <button onClick={() => onOpen(f.box)} className="ml-auto text-[11.5px] text-[#0E6FA0] underline">Open this box</button>
                </div>
                <div className={`text-[12px] ${t.text}`}>{f.issue}</div>
                {f.snippet && (
                  <div className="text-[11.5px] text-[#4a5157] bg-white border border-[#E6E2DA] rounded-md px-2.5 py-1.5 mt-1.5 leading-relaxed">
                    … {highlight(f.snippet, f.words)} …
                  </div>
                )}
                {f.fix === 'preApproval' && onFix && (
                  <button onClick={() => onFix('preApproval')}
                    className="mt-2 bg-white border border-[#C9A227] text-[#7a5c14] text-[11.5px] font-bold rounded-lg px-3 py-1.5 hover:bg-[#FFFCF3]">
                    This is a pre-approval — there is no property yet
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="px-5 py-3.5 border-t border-[#F0F2F4] bg-[#FBFCFD] flex items-center gap-2.5 flex-wrap">
          <button onClick={onProceed} className="bg-[#343333] text-white text-[13px] font-bold rounded-lg px-4 py-2">Continue anyway</button>
          <button onClick={onCancel} className="border border-[#DDE1E5] text-[#5a6169] text-[13px] rounded-lg px-4 py-2">Go back and fix</button>
          <span className="ml-auto text-[11.5px] text-[#9aa0a6]">Checks run on the text as it stands right now.</span>
        </div>
      </div>
    </div>
  )
}

// --- what credit is told -----------------------------------------------------

export function PushForm({ deal, dealName, answers, setAnswers, onPush, onCancel, busy }: {
  deal: any
  dealName: string
  answers: PushAnswers
  setAnswers: (a: PushAnswers) => void
  onPush: () => void
  onCancel: () => void
  busy?: boolean
}) {
  const [tried, setTried] = useState(false)
  const missing = missingAnswers(answers)
  const set = (patch: Partial<PushAnswers>) => setAnswers({ ...answers, ...patch })
  const liabilities = answers.liabilities || []
  const refi = isRefinanceDeal(deal)
  const inv = isInvestmentPurchase(deal)

  function toggleLiability(id: string) {
    set({ liabilities: liabilities.map(l => l.id === id ? { ...l, closing: !l.closing } : l) })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-6 overflow-y-auto" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-[820px] max-w-full shadow-2xl mt-8 mb-8 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4">
          <div className="text-[16.5px] font-bold text-[#111]">Push to SalesTrekker</div>
          <div className="text-[12.5px] text-[#7b828a] mt-1">
            {dealName} · these answers go into the email to credit, with the handover and the compliance pack attached.
          </div>
        </div>

        <Group title="Commission">
          <div className="flex items-center gap-3 flex-wrap">
            <Choice<Commission>
              options={[['simplify_100', COMMISSION_LABEL.simplify_100], ['check_label', COMMISSION_LABEL.check_label]]}
              value={answers.commission} onChange={v => set({ commission: v })} />
            <span className="text-[11.5px] text-[#a3aab0]">Recorded and passed to credit. The label split itself is not built here yet.</span>
          </div>
        </Group>

        <Group title="Timing">
          <div className="flex gap-6 items-end flex-wrap">
            <div>
              <span className={lab}>Is this deal urgent?</span>
              <Choice<'no' | 'yes'> options={[['no', 'No'], ['yes', 'Yes']]}
                value={answers.urgent ? 'yes' : 'no'}
                onChange={v => set({ urgent: v === 'yes' })} />
            </div>
            <div className="min-w-[200px]">
              <span className={lab}>Compliance needed by</span>
              <input type="date" className={inp} value={answers.complianceNeededBy || ''}
                onChange={e => set({ complianceNeededBy: e.target.value })} />
            </div>
            <div className="flex-1 min-w-[220px]">
              <span className={lab}>Why the rush (optional)</span>
              <input className={inp} value={answers.urgentReason || ''}
                onChange={e => set({ urgentReason: e.target.value })} placeholder="Finance clause expires Monday…" />
            </div>
          </div>
          {answers.urgent && (
            <div className="mt-2.5 border border-[#EFD3CB] bg-[#FBEDE9] rounded-lg px-3 py-2 text-[11.5px] text-[#8A3A2A] leading-relaxed">
              Marked urgent, so this deal gets an <b>Urgent</b> chip on its card and sits at the top of its
              column until it is lodged.
            </div>
          )}
        </Group>

        <Group title="Liabilities to be closed" note="Brought in from the Fact Find. Tick what is actually closing at settlement.">
          {liabilities.length === 0 && (
            <div className="text-[12px] text-[#a3aab0] italic">No liabilities on the fact find.</div>
          )}
          {liabilities.map(l => (
            <div key={l.id}
              className={`flex items-center gap-3 px-3 py-2 border rounded-lg mb-1.5 ${l.closing ? 'border-[#eef0f2] bg-white' : 'border-[#eef0f2] bg-[#FBFCFD]'}`}>
              <input type="checkbox" checked={l.closing} onChange={() => toggleLiability(l.id)} />
              <span className={`text-[12.5px] text-[#343333] ${l.closing ? 'font-medium' : ''}`}>{l.label}</span>
              <span className="text-[11.5px] text-[#9aa0a6]">{l.detail}</span>
              <span className={`ml-auto text-[11px] ${l.closing ? 'text-[#B04A4A] font-semibold' : 'text-[#9aa0a6]'}`}>
                {l.closing ? 'Closing at settlement' : 'Staying'}
              </span>
            </div>
          ))}
          {liabilities.length > 0 && (
            <div className="text-[11.5px] text-[#a3aab0] mt-1">Anything ticked here is what credit will tell the lender is being paid out.</div>
          )}
        </Group>

        <Group title="Identification">
          <div className="flex gap-6 items-end flex-wrap">
            <div>
              <span className={lab}>How was ID completed?</span>
              <Choice<IdMethod>
                options={[['face_to_face', ID_METHOD_LABEL.face_to_face], ['virtual', ID_METHOD_LABEL.virtual]]}
                value={answers.idMethod} onChange={v => set({ idMethod: v, idService: v === 'virtual' ? answers.idService : undefined })} />
            </div>
            {answers.idMethod === 'virtual' && (
              <div>
                <span className={lab}>Which service</span>
                <Choice<IdService>
                  options={[['idyou', ID_SERVICE_LABEL.idyou], ['infotrack', ID_SERVICE_LABEL.infotrack], ['facetime', ID_SERVICE_LABEL.facetime]]}
                  value={answers.idService} onChange={v => set({ idService: v })} />
              </div>
            )}
          </div>
        </Group>

        {/* A refinance sees the discharge. A purchase never does. */}
        {refi && (
          <Group title="Discharge">
            <label className="flex items-start gap-3 border border-[#EBD9BE] bg-[#FDF6EC] rounded-lg px-3.5 py-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={!!answers.dischargePrepared}
                onChange={e => set({ dischargePrepared: e.target.checked })} />
              <span>
                <span className="block text-[12.5px] font-bold text-[#8A6218] mb-0.5">Prepare the discharge authority</span>
                <span className="block text-[11.5px] text-[#8A6218] leading-relaxed">
                  The discharge takes the longest of anything between here and settlement, so it starts now
                  rather than when the loan is approved.
                </span>
              </span>
            </label>
          </Group>
        )}

        {/* Only an INVESTMENT purchase. An owner occupied buyer is not letting the place out. */}
        {inv && (
          <Group title="Investment details" note="This is an investment purchase.">
            <div className="flex gap-3.5 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <span className={lab}>Proposed rental income (monthly)</span>
                <input className={inp} value={answers.rentalIncome || ''} placeholder="$0"
                  onChange={e => set({ rentalIncome: e.target.value })} />
              </div>
              <div className="flex-1 min-w-[200px]">
                <span className={lab}>Proposed investment expenses (monthly)</span>
                <input className={inp} value={answers.investmentExpenses || ''} placeholder="$0"
                  onChange={e => set({ investmentExpenses: e.target.value })} />
              </div>
            </div>
          </Group>
        )}

        <Group title="Additional notes">
          <textarea spellCheck="true" className={inp + ' min-h-[70px] resize-y'} value={answers.notes || ''}
            onChange={e => set({ notes: e.target.value })}
            placeholder="Anything credit needs to know that is not already on the file…" />
        </Group>

        {tried && missing.length > 0 && (
          <div className="mx-5 mb-3 border border-[#F5C2C2] bg-[#FDF0EF] rounded-lg px-3.5 py-3">
            {missing.map(m => <div key={m} className="text-[12.5px] text-[#8A3A3A]">{m}</div>)}
          </div>
        )}

        <div className="px-5 py-3.5 border-t border-[#F0F2F4] bg-[#FBFCFD] flex items-center gap-2.5 flex-wrap">
          <button disabled={busy}
            onClick={() => { setTried(true); if (missingAnswers(answers).length === 0) onPush() }}
            className="bg-[#2DBEFF] text-white text-[13px] font-bold rounded-lg px-4 py-2 disabled:opacity-40">
            {busy ? 'Pushing…' : 'Push to SalesTrekker'}
          </button>
          <button onClick={onCancel} disabled={busy} className="border border-[#DDE1E5] text-[#5a6169] text-[13px] rounded-lg px-4 py-2">Cancel</button>
          <span className="ml-auto text-[11.5px] text-[#9aa0a6]">Answers are saved on the deal, so a second push does not start from scratch.</span>
        </div>
      </div>
    </div>
  )
}

export type { PushAnswers, LiabilityChoice }
