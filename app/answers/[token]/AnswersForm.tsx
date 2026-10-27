'use client'
import { useState } from 'react'
import type { ClientQuestion } from '@/lib/answers-flow'
import type { Answer, AddressAnswer, EmploymentAnswer, AssetAnswer } from '@/lib/answers-from-the-client'

// THE BOXES A CLIENT TYPES INTO, AND NOTHING ELSE.
//
// 27 Oct 2026.
//
// THE ONE RULE THAT MAKES THIS SAFE IS HELD BY WHAT IS DRAWN.
//
//   A client can fill in something empty.
//   A client can never change something that has a value.
//
// Everything we already hold is shown LOCKED - there is no box to type in, so
// there is no way to ask the question. lib/answers-from-the-client.ts enforces
// the same rule a second time for a request that did not come from here, but
// this is the line that matters: a control that cannot be reached cannot be
// misused.
//
// AND IT SHOWS WHAT WE HAVE RATHER THAN HIDING IT. "Where did you live before
// September 2024" with the current address printed above it is a question with
// an obvious answer. The same sentence on a blank page is a memory test.
//
// BUT ONLY THAT. This file used to take the whole fact find as a prop so it
// could pick four strings out of it - and a client component's props are
// serialised into the page source, so every income figure and every liability
// on the file was readable by anybody holding the link. The locked lines are
// built on the server now and arrive as plain sentences. Nothing else about
// the deal reaches this page: no figures, no lender, no commission, no notes.
// Fabio, 27 Oct 2026: "thats really important cleints dont have access to the
// portal."
//
// So: never add a prop here that is a record. If something needs a fact from
// the file, lib/answers-flow.ts turns it into the one line that is needed.

type AddrRow = AddressAnswer
type JobRow = EmploymentAnswer
type AssetRow = AssetAnswer

const blankAddr = (): AddrRow => ({ address: '', residentialStatus: '', startDate: '', endDate: '' })
const blankJob = (): JobRow => ({ employerName: '', occupation: '', startDate: '', endDate: '' })
const blankAsset = (): AssetRow => ({ description: '', value: '', make: '', model: '', year: '' })

const txt = (v: any) => String(v ?? '').trim()

export default function AnswersForm({ token, questions, onSave }: {
  token: string
  questions: ClientQuestion[]
  onSave: (token: string, answers: Answer[]) => Promise<{ ok: boolean; why?: string }>
}) {
  const [addr, setAddr] = useState<Record<string, AddrRow[]>>({})
  const [jobs, setJobs] = useState<Record<string, JobRow[]>>({})
  const [one, setOne] = useState<Record<string, string>>({})
  const [ages, setAges] = useState<string[]>([])
  const [assets, setAssets] = useState<Record<string, AssetRow[]>>({})
  const [none, setNone] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const rowsA = (k: string) => addr[k] || [blankAddr()]
  const rowsJ = (k: string) => jobs[k] || [blankJob()]
  const rowsX = (k: string) => assets[k] || [blankAsset()]

  function build(): Answer[] {
    const out: Answer[] = []
    for (const q of questions) {
      const id = txt(q.applicantId)
      if (q.kind === 'address_history') {
        const rows = rowsA(q.key).filter(r => txt(r.address) || txt(r.startDate))
        if (rows.length) out.push({ key: q.key, kind: 'address_history', applicantId: id, addresses: rows })
      } else if (q.kind === 'employment_history') {
        const rows = rowsJ(q.key).filter(r => txt(r.employerName) || txt(r.startDate))
        if (rows.length) out.push({ key: q.key, kind: 'employment_history', applicantId: id, jobs: rows })
      } else if (q.kind === 'residency' || q.kind === 'marital') {
        const v = txt(one[q.key])
        if (v) out.push({ key: q.key, kind: q.kind, applicantId: id, value: v })
      } else if (q.kind === 'dependant_ages') {
        const list = ages.map(txt).filter(Boolean)
        if (list.length) out.push({ key: q.key, kind: 'dependant_ages', ages: list })
      } else if (q.kind === 'vehicle' || q.kind === 'home_contents' || q.kind === 'super' || q.kind === 'shares') {
        if (none[q.key]) { out.push({ key: q.key, kind: q.kind, assets: [], none: true }); continue }
        const rows = rowsX(q.key).filter(r => txt(r.value) || txt(r.description) || txt(r.make))
        if (rows.length) out.push({ key: q.key, kind: q.kind, assets: rows })
      }
    }
    return out
  }

  async function send() {
    const answers = build()
    if (!answers.length) {
      setErr('Nothing filled in yet — add what you can and press it again.')
      return
    }
    setBusy(true); setErr('')
    try {
      const out = await onSave(token, answers)
      if (out?.ok) setDone(true)
      else setErr(out?.why === 'expired'
        ? 'This link has expired. Reply to the email and we will send a new one.'
        : 'That did not save. Please reply to the email instead and we will put it in for you.')
    } catch {
      setErr('That did not save. Please reply to the email instead and we will put it in for you.')
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div style={{ ...PANEL, background: '#EAFAF4', borderColor: '#B4E7D5' }}>
        <b style={{ fontSize: 16, color: '#137A55' }}>Thank you — that has gone through.</b>
        <p style={{ fontSize: 14, color: '#4D4841', margin: '7px 0 0', lineHeight: 1.6 }}>
          It is on your file already. You can close this page. If anything else is needed we
          will be in touch.
        </p>
      </div>
    )
  }

  return (
    <div>
      {questions.map(q => (
        <div key={q.key} style={PANEL}>
          <b style={{ fontSize: 16, color: '#17140F', display: 'block', lineHeight: 1.4 }}>{q.ask}</b>
          {q.help && <p style={HELP}>{q.help}</p>}

          {q.kind === 'address_history' && (
            <>
              <Known rows={q.known} />
              {rowsA(q.key).map((r, i) => (
                <div key={i} style={ROW}>
                  <input style={{ ...F, flex: 1, minWidth: 230 }} value={r.address}
                    placeholder="Street, suburb, state, postcode"
                    onChange={e => setAddr(s => ({ ...s, [q.key]: swap(rowsA(q.key), i, { address: e.target.value }) }))} />
                  <select style={{ ...F, width: 170 }} value={r.residentialStatus}
                    onChange={e => setAddr(s => ({ ...s, [q.key]: swap(rowsA(q.key), i, { residentialStatus: e.target.value }) }))}>
                    <option value="">Renting, owner…</option>
                    <option>Renting</option><option>Owner</option>
                    <option>Boarding</option><option>Living with family</option>
                  </select>
                  <Month label="From" value={r.startDate}
                    onChange={v => setAddr(s => ({ ...s, [q.key]: swap(rowsA(q.key), i, { startDate: v }) }))} />
                  <Month label="To" value={r.endDate}
                    onChange={v => setAddr(s => ({ ...s, [q.key]: swap(rowsA(q.key), i, { endDate: v }) }))} />
                </div>
              ))}
              <Add onClick={() => setAddr(s => ({ ...s, [q.key]: [...rowsA(q.key), blankAddr()] }))}>
                + Another address before that
              </Add>
            </>
          )}

          {q.kind === 'employment_history' && (
            <>
              <Known rows={q.known} />
              {rowsJ(q.key).map((r, i) => (
                <div key={i} style={ROW}>
                  <input style={{ ...F, flex: 1, minWidth: 210 }} value={r.employerName} placeholder="Employer"
                    onChange={e => setJobs(s => ({ ...s, [q.key]: swap(rowsJ(q.key), i, { employerName: e.target.value }) }))} />
                  <input style={{ ...F, width: 180 }} value={r.occupation} placeholder="What you did"
                    onChange={e => setJobs(s => ({ ...s, [q.key]: swap(rowsJ(q.key), i, { occupation: e.target.value }) }))} />
                  <Month label="From" value={r.startDate}
                    onChange={v => setJobs(s => ({ ...s, [q.key]: swap(rowsJ(q.key), i, { startDate: v }) }))} />
                  <Month label="To" value={r.endDate}
                    onChange={v => setJobs(s => ({ ...s, [q.key]: swap(rowsJ(q.key), i, { endDate: v }) }))} />
                </div>
              ))}
              <Add onClick={() => setJobs(s => ({ ...s, [q.key]: [...rowsJ(q.key), blankJob()] }))}>
                + Another job before that
              </Add>
            </>
          )}

          {(q.kind === 'residency' || q.kind === 'marital') && (
            <div style={ROW}>
              <select style={{ ...F, width: 290 }} value={one[q.key] || ''}
                onChange={e => setOne(s => ({ ...s, [q.key]: e.target.value }))}>
                <option value="">Choose one</option>
                {(q.kind === 'residency'
                  ? ['Australian citizen', 'Permanent resident', 'Temporary visa', 'Non-resident']
                  : ['Single', 'Married', 'De facto', 'Separated', 'Divorced', 'Widowed']
                ).map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          )}

          {q.kind === 'dependant_ages' && (
            <>
              <div style={ROW}>
                {Array.from({ length: Math.max(q.count || 1, ages.length) }).map((_, i) => (
                  <input key={i} style={{ ...F, width: 110 }} value={ages[i] || ''} placeholder="Age"
                    inputMode="numeric"
                    onChange={e => setAges(a => {
                      const next = [...a]; next[i] = e.target.value; return next
                    })} />
                ))}
              </div>
              <Add onClick={() => setAges(a => [...a, ''])}>+ Another dependant</Add>
            </>
          )}

          {(q.kind === 'vehicle' || q.kind === 'home_contents' || q.kind === 'super' || q.kind === 'shares') && (
            <>
              {!none[q.key] && rowsX(q.key).map((r, i) => (
                <div key={i} style={ROW}>
                  {q.kind === 'vehicle' ? (
                    <>
                      <input style={{ ...F, width: 130 }} value={r.make || ''} placeholder="Make"
                        onChange={e => setAssets(s => ({ ...s, [q.key]: swap(rowsX(q.key), i, { make: e.target.value }) }))} />
                      <input style={{ ...F, width: 150 }} value={r.model || ''} placeholder="Model"
                        onChange={e => setAssets(s => ({ ...s, [q.key]: swap(rowsX(q.key), i, { model: e.target.value }) }))} />
                      <input style={{ ...F, width: 90 }} value={r.year || ''} placeholder="Year" inputMode="numeric"
                        onChange={e => setAssets(s => ({ ...s, [q.key]: swap(rowsX(q.key), i, { year: e.target.value }) }))} />
                    </>
                  ) : (
                    <input style={{ ...F, flex: 1, minWidth: 220 }} value={r.description}
                      placeholder={q.kind === 'super' ? 'Fund name'
                        : q.kind === 'shares' ? 'Holding — company or fund' : 'What it covers'}
                      onChange={e => setAssets(s => ({ ...s, [q.key]: swap(rowsX(q.key), i, { description: e.target.value }) }))} />
                  )}
                  <input style={{ ...F, width: 150 }} value={r.value} placeholder="Rough value" inputMode="decimal"
                    onChange={e => setAssets(s => ({ ...s, [q.key]: swap(rowsX(q.key), i, { value: e.target.value }) }))} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
                {!none[q.key] && (
                  <Add onClick={() => setAssets(s => ({ ...s, [q.key]: [...rowsX(q.key), blankAsset()] }))}>
                    + Add another
                  </Add>
                )}
                {/* NOBODY ASKED IS NOT THEY HAVE NONE. Both have to be sayable
                    or the question is asked again in the next email. */}
                <button type="button" onClick={() => setNone(s => ({ ...s, [q.key]: !s[q.key] }))}
                  style={{ ...ADD, borderStyle: 'solid',
                    borderColor: none[q.key] ? '#137A55' : '#DCD5C9',
                    color: none[q.key] ? '#137A55' : '#6F6A62',
                    background: none[q.key] ? '#EAFAF4' : '#FFFFFF' }}>
                  {none[q.key] ? '✓ ' : ''}{noneWords(q.kind)}
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {err && <p style={{ fontSize: 14, color: '#D32F2F', margin: '0 0 12px', lineHeight: 1.55 }}>{err}</p>}

      <button type="button" onClick={send} disabled={busy} style={SEND}>
        {busy ? 'Sending…' : 'Send these'}
      </button>
      <p style={{ fontSize: 12.5, color: '#A79F93', margin: '11px 0 0', lineHeight: 1.6 }}>
        Only what you type here is sent. Nothing already on your file is changed.
      </p>
    </div>
  )
}

function swap<T>(rows: T[], i: number, patch: Partial<T>): T[] {
  return rows.map((r, k) => k === i ? { ...r, ...patch } : r)
}

function noneWords(kind: string): string {
  return kind === 'vehicle' ? 'We do not own a car'
    : kind === 'shares' ? 'We hold no shares'
    : kind === 'super' ? 'I have no super'
    : 'Nothing to put here'
}

/** What we already hold, shown and locked. The rule, drawn. */
function Known({ rows }: { rows: string[] }) {
  if (!rows.length) return null
  return (
    <div style={{ marginBottom: 10 }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          background: '#F7F4EF', border: '1px solid #DCD5C9', borderRadius: 8,
          padding: '9px 12px', fontSize: 13.5, color: '#6F6A62', marginBottom: 5,
          display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap',
        }}>
          <span style={{ color: '#4D4841', fontWeight: 600 }}>{r}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#A79F93' }}>already on file</span>
        </div>
      ))}
    </div>
  )
}

function Month({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // A MONTH, NOT A DAY. Nobody remembers the day they moved out of a flat four
  // years ago, and a box that demands one gets a guess or gets abandoned.
  return (
    <input style={{ ...F, width: 130 }} type="month" value={toMonth(value)} aria-label={label}
      placeholder={label} onChange={e => onChange(e.target.value ? `${e.target.value}-01` : '')} />
  )
}

function toMonth(v: string): string {
  const m = txt(v).match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : ''
}

function Add({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={ADD}>{children}</button>
}

const PANEL: React.CSSProperties = {
  border: '1px solid #EBE5DB', borderRadius: 12, padding: '16px 17px', marginBottom: 13,
  background: '#FFFFFF',
}
const HELP: React.CSSProperties = {
  fontSize: 13.5, color: '#6F6A62', margin: '5px 0 12px', lineHeight: 1.55,
}
const ROW: React.CSSProperties = {
  display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8,
}
const F: React.CSSProperties = {
  border: '1px solid #DCD5C9', borderRadius: 8, padding: '10px 12px', fontSize: 15,
  fontFamily: 'inherit', color: '#17140F', background: '#FFFFFF',
}
const ADD: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, color: '#0E8FCB', background: '#FFFFFF',
  border: '1px dashed #BFE6F9', borderRadius: 8, padding: '8px 14px', marginTop: 9,
  fontFamily: 'inherit', cursor: 'pointer',
}
const SEND: React.CSSProperties = {
  background: '#107EA8', color: '#FFFFFF', border: 0, fontSize: 16, fontWeight: 600,
  borderRadius: 9, padding: '13px 28px', fontFamily: 'inherit', cursor: 'pointer',
}
