'use client'
import { useState } from 'react'
import DropZone from '@/components/DropZone'
import { sendToBeRead, readAnswer } from '@/lib/send-a-document-to-be-read'
import {
  whySimpleCannot, whatIsMissing, twoYears, KIND_WORDS, type ReadDocument,
} from '@/lib/tax-documents'
import { columnsFor, leftOut, LINES, yearsBehind, type Year, type Column } from '@/lib/se-comparison'
import { money } from '@/lib/money'

// THE SELF-EMPLOYED INCOME READ OFF THE RETURNS.
//
// 22 Nov 2026. Built from docs/approved-looks/self-employed-income.html and
// the three mocks beside it, which Fabio signed off before a line of this was
// written. lib/the-look-of-self-employed-income.test.ts reads those files off
// disk and checks this against them.
//
// FOUR THINGS THIS SCREEN IS, IN ORDER:
//
//   1. A QUESTION WITH ITS LIMITS WRITTEN ON IT. Fabio: "SIMPLE ONLY read
//      company and individual, doesnt read trust, multiple entities etc - so
//      we need to GUIDE my team." Each route lists what it does and does not
//      do, before anybody wastes five minutes dropping a trust return.
//
//   2. A READER THAT STOPS. It never reads three documents out of four and
//      leaves the fourth to be noticed. See lib/tax-documents.ts.
//
//   3. A COMPARISON WITH NOTHING CHOSEN. Fabio: "show all 4 so WE not lender
//      dictated which one WE will use and then find the lender to match it."
//      Every column says Use this; none is highlighted until pressed.
//
//   4. A WRITE INTO THE FIELDS THAT ALREADY EXIST. Pressing a column writes
//      seAssessmentMethod, seGrowthMethod and seGrowthPercentOption - the same
//      fields the dropdown has always written, read in eight places including
//      the compliance notes. Nothing downstream changes.

const n = (v: any) => {
  const x = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(x) ? x : 0
}
const dollars = (v: number) => money(Math.round(v)) || '$0'

type Props = {
  inc: any
  onChange: (field: string, value: any) => void
  /** Several fields at once - picking a column writes four. */
  onChangeMany: (patch: Record<string, any>) => void
  me?: string
  busy?: boolean
}

export default function SelfEmployedFromReturns({ inc, onChange, onChangeMany, me, busy }: Props) {
  const [reading, setReading] = useState('')
  const [problem, setProblem] = useState('')
  const docs: ReadDocument[] = Array.isArray(inc?.seDocuments) ? inc.seDocuments : []

  // ONE DOCUMENT AT A TIME, so a failure can name the file that failed rather
  // than losing the whole drop. Same rule the payslips follow.
  async function drop(files: File[]) {
    setProblem('')
    const got: ReadDocument[] = [...docs]
    for (const file of files) {
      setReading(file.name)
      try {
        const sent = await sendToBeRead(file)
        const res = await fetch('/api/read-tax-document', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...sent.body, fileName: file.name }),
        })
        const answer = await readAnswer(res)
        if (!answer.ok) { setProblem(`${file.name} — ${answer.why}`); break }
        got.push(answer.out as ReadDocument)
      } catch (e: any) {
        setProblem(`${file.name} — ${e?.message || 'could not be read'}`)
        break
      }
    }
    setReading('')
    onChange('seDocuments', got)
  }

  // --- the route ----------------------------------------------------------
  if (!inc?.seRoute) {
    return (
      <div className="mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <Route on={false} onPick={() => onChange('seRoute', 'simple')}
            title="Simple — read the returns"
            yes={['Individual tax returns', 'One company — financials or the company return', 'Two financial years']}
            noHead="It does not read"
            no={['Trusts', 'Partnerships', 'More than one business', 'Anything with no tax returns']} />
          <Route on={false} onPick={() => onChange('seRoute', 'complex')}
            title="Complex — do it by hand"
            yesHead="Use this for"
            yes={['Trusts and partnerships', 'More than one business', 'Low doc — BAS or accountant’s letter', 'Director’s salary only']}
            noHead="How it works"
            no={['Choose the method yourself', 'Type the figures, exactly as today']} />
        </div>
      </div>
    )
  }

  if (inc.seRoute === 'complex') return null   // the form below is the complex route

  // --- simple -------------------------------------------------------------
  const stop = whySimpleCannot(docs)
  const missing = docs.length > 0 && !stop ? whatIsMissing(docs) : ''
  const fys = twoYears(docs)
  const earlier = fys.length === 2 ? yearFrom(docs, fys[0]) : null
  const latest = fys.length >= 1 ? yearFrom(docs, fys[fys.length - 1]) : null
  const pct = inc.seGrowthPercentOption === 'Other'
    ? inc.seGrowthPercentCustom : (inc.seGrowthPercentOption || '20')
  const cols = columnsFor(earlier, latest, pct)
  const chosen: Column | undefined = cols.find(c => c.id === inc.seChosenColumn)

  function use(c: Column) {
    onChangeMany({
      seChosenColumn: c.id,
      seLockedBy: me || '',
      seLockedAt: new Date().toISOString(),
      ...c.writes,
      // The figures themselves go in the boxes the portal already has, so the
      // BC, the compliance notes and the handover read what they always read.
      ...(earlier ? yearPatch(1, earlier) : {}),
      ...(latest ? yearPatch(2, latest) : {}),
    })
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11.5px] text-muted ml-auto">
          Simple — read the returns ·{' '}
          <button type="button" onClick={() => onChange('seRoute', '')}
            className="text-brand-ink font-semibold">change route</button>
        </span>
      </div>

      <DropZone multiple accept="application/pdf" busy={!!reading || busy}
        title={reading ? `Reading ${reading}…` : 'Drop the tax returns and financials here'}
        hint="individual returns, and one company’s financials or return"
        onFiles={drop} />

      {problem && (
        <div className="mt-2 text-[12.5px] rounded-lg border border-chase-edge bg-chase-bg text-chase px-3 py-2">
          {problem}
        </div>
      )}

      {docs.length > 0 && <Documents docs={docs} />}

      {/* IT STOPPED. Said in the words of what it found, with a way out that
          keeps the work - see lib/tax-documents.ts. */}
      {stop && (
        <div className="mt-3 rounded-xl border border-waiting-edge bg-waiting-bg px-4 py-4">
          <p className="m-0 text-[15px] font-bold text-ink">{stop.title}</p>
          <p className="mt-1 mb-3 text-[13px] leading-relaxed text-body max-w-[700px]">{stop.why}</p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => onChange('seRoute', 'complex')}
              className="rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-page">
              Switch to complex
            </button>
            {stop.without && (
              <button type="button" onClick={() => onChange('seDocuments', keepSimple(docs))}
                className="rounded-lg border border-field-line bg-card px-4 py-2 text-[13px] font-semibold text-body">
                {stop.without}
              </button>
            )}
          </div>
        </div>
      )}

      {missing && !stop && (
        <p className="mt-3 mb-0 text-[12.5px] text-chase">{missing}</p>
      )}

      {!stop && cols.length > 0 && (
        <Comparison cols={cols} earlier={earlier} latest={latest} chosen={chosen}
          onUse={use} pct={String(pct)} onPct={v => onChange('seGrowthPercentOption', v)} />
      )}

      {chosen && (
        <div className="mt-3 flex gap-3 items-start rounded-xl border border-done-edge bg-done-bg px-4 py-3.5">
          <span className="flex-none w-[26px] h-[26px] rounded-full bg-done text-page
                           flex items-center justify-center text-[14px] font-bold">&#10003;</span>
          <div className="flex-1">
            <p className="m-0 text-[15.5px] font-bold text-ink">
              {dollars(chosen.total)} is this applicant&rsquo;s assessable income
            </p>
            <p className="mt-0.5 mb-0 text-[13px] leading-relaxed text-body">
              {chosen.title}{chosen.under ? `, ${chosen.under}` : ''} — {yearsBehind(chosen, earlier, latest)}.
              {inc.seLockedBy ? ` ${inc.seLockedBy}.` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// --- the pieces -------------------------------------------------------------

function Route({ on, onPick, title, yes, yesHead = '✓ It reads', no, noHead }: {
  on: boolean; onPick: () => void; title: string
  yes: string[]; yesHead?: string; no: string[]; noHead: string
}) {
  return (
    <button type="button" onClick={onPick}
      className={`text-left rounded-xl border-2 px-4 py-4 transition ${
        on ? 'border-ink bg-page' : 'border-card-line bg-card hover:border-field-line'}`}>
      <span className="flex items-center gap-2.5 text-[16px] font-bold text-ink">
        <span className={`w-[18px] h-[18px] rounded-full flex-none border-2 ${
          on ? 'border-ink bg-ink shadow-[inset_0_0_0_3px_#fff]' : 'border-field-line'}`} />
        {title}
      </span>
      <span className="block mt-2.5 text-[10.5px] font-extrabold tracking-[.06em] uppercase text-done">
        {yesHead}
      </span>
      <ul className="mt-1 mb-0 pl-5 list-disc">
        {yes.map(t => <li key={t} className="text-[13px] leading-snug text-body">{t}</li>)}
      </ul>
      <span className="block mt-2.5 text-[10.5px] font-extrabold tracking-[.06em] uppercase text-muted">
        {noHead}
      </span>
      <ul className="mt-1 mb-0 pl-5 list-disc">
        {no.map(t => <li key={t} className="text-[13px] leading-snug text-faint">{t}</li>)}
      </ul>
    </button>
  )
}

function Documents({ docs }: { docs: ReadDocument[] }) {
  return (
    <div className="mt-3 rounded-xl border border-card-line overflow-hidden">
      <div className="flex bg-page px-3.5 py-2 text-[10.5px] font-extrabold tracking-[.07em] uppercase text-muted">
        <span className="flex-[1.4]">Whose</span>
        <span className="flex-[1.3]">What</span>
        <span className="w-[130px]">Year</span>
        <span className="w-[120px] text-right">Read</span>
      </div>
      {docs.map((d, i) => (
        <div key={`${d.fileName}-${i}`} className="flex px-3.5 py-2.5 border-t border-line-soft text-[13.5px] items-baseline">
          <span className="flex-[1.4] font-semibold text-ink">
            {d.entityName || <span className="text-faint font-normal">&mdash;</span>}
            {d.abn && <span className="block text-[12px] font-normal text-muted">ABN {d.abn}</span>}
          </span>
          <span className="flex-[1.3] text-muted">
            {KIND_WORDS[d.kind]}
            <span className="block text-[12px] text-faint">{d.fileName}</span>
          </span>
          <span className="w-[130px] text-body font-semibold">
            {(d.years || []).map(y => y.fy).filter(Boolean).join(' and ') || '—'}
          </span>
          <span className="w-[120px] text-right text-[12.5px] font-bold">
            {d.kind === 'unknown'
              ? <span className="text-chase">needs you</span>
              : d.kind === 'trust_return' || d.kind === 'partnership_return'
                ? <span className="text-waiting">not read</span>
                : <span className="text-done">&#10003; read</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

function Comparison({ cols, earlier, latest, chosen, onUse, pct, onPct }: {
  cols: Column[]; earlier: Year | null; latest: Year | null
  chosen?: Column; onUse: (c: Column) => void; pct: string; onPct: (v: string) => void
}) {
  const read = [earlier, latest].filter(Boolean) as Year[]
  const td = 'px-3.5 py-2.5 text-[14px] text-right border-b border-line-soft'
  const sel = (c: Column) => c.id === chosen?.id

  return (
    <div className="mt-4 rounded-xl border border-card-line overflow-hidden">
      <table className="w-full border-collapse table-fixed">
        <colgroup><col className="w-[232px]" />{[...read, ...cols].map((_, i) => <col key={i} />)}</colgroup>
        <tbody>
          {/* TWO BANDS. What the documents said, and what you could do with it. */}
          <tr>
            <th className="border-b border-line" />
            <th colSpan={read.length}
              className="bg-page px-3.5 py-2 text-[10.5px] font-extrabold tracking-[.09em] uppercase
                         text-muted text-center border-b border-line">
              As read off the documents
            </th>
            <th colSpan={cols.length}
              className="bg-info-bg px-3.5 py-2 text-[10.5px] font-extrabold tracking-[.09em] uppercase
                         text-info text-center border-b border-line">
              What you could use
            </th>
          </tr>
          <tr>
            <th className="border-b border-line" />
            {read.map(y => (
              <th key={y.fy} className="bg-page px-3.5 pt-2.5 pb-2 text-right align-bottom border-b border-line">
                <span className="block text-[12.5px] font-bold text-ink">{y.fy}</span>
                <span className="block text-[11px] font-semibold text-faint">yr end 30 Jun</span>
              </th>
            ))}
            {cols.map(c => (
              <th key={c.id}
                className={`px-3.5 pt-2.5 pb-2 text-right align-bottom border-b ${
                  sel(c) ? 'bg-ink border-ink' : 'bg-card border-line'}`}>
                <span className={`block text-[12.5px] font-bold ${sel(c) ? 'text-page' : 'text-ink'}`}>
                  {c.title}</span>
                <span className={`block text-[11px] font-semibold ${sel(c) ? 'text-page/70' : 'text-faint'}`}>
                  {c.under}</span>
              </th>
            ))}
          </tr>

          {LINES.filter(l => read.some(y => n(y[l.key]) !== 0)).map(l => (
            <tr key={l.key}>
              <td className="px-3.5 py-2.5 text-[13.5px] text-ink border-b border-line-soft">{l.label}</td>
              {read.map(y => (
                <td key={y.fy} className={`${td} bg-page ${l.add ? 'text-done font-semibold' : 'text-muted'}`}>
                  {l.add ? '+' : ''}{dollars(n(y[l.key]))}
                </td>
              ))}
              {cols.map(c => (
                <td key={c.id} className={`${td} ${sel(c) ? 'bg-done-bg text-ink font-semibold' : 'bg-card'} ${
                  l.add ? 'text-done font-semibold' : ''}`}>
                  {n(c.lines[l.key]) === 0 ? <span className="text-faint">&mdash;</span>
                    : <>{l.add ? '+' : ''}{dollars(c.lines[l.key])}</>}
                </td>
              ))}
            </tr>
          ))}

          <tr>
            <td className="px-3.5 pt-3 pb-3.5 text-[11px] font-extrabold tracking-[.08em] uppercase
                           text-ink border-t-2 border-ink">Assessable</td>
            {read.map(y => (
              <td key={y.fy} className="bg-page px-3.5 pt-3 pb-3.5 text-right text-[18px] font-bold
                                        text-ink border-t-2 border-ink">
                {dollars(LINES.reduce((t, l) => t + n(y[l.key]), 0))}
              </td>
            ))}
            {cols.map(c => (
              <td key={c.id} className={`px-3.5 pt-3 pb-3.5 text-right text-[18px] font-bold border-t-2
                border-ink ${sel(c) ? 'bg-done-bg text-done' : 'bg-card text-ink'}`}>
                {dollars(c.total)}
              </td>
            ))}
          </tr>

          <tr>
            <td className="px-3.5 pt-3 pb-4" />
            {read.map(y => <td key={y.fy} className="bg-page" />)}
            {cols.map(c => (
              <td key={c.id} className={`px-3.5 pt-3 pb-4 align-top ${sel(c) ? 'bg-done-bg' : 'bg-card'}`}>
                <button type="button" onClick={() => onUse(c)}
                  className={`w-full rounded-lg py-2.5 text-[13.5px] font-bold border ${
                    sel(c) ? 'bg-done text-white border-done'
                           : 'bg-card text-body border-field-line hover:border-ink'}`}>
                  {sel(c) ? 'Using this' : 'Use this'}
                </button>
                <p className="mt-1.5 mb-0 text-[12px] leading-snug text-muted text-right">{c.why}</p>
                {/* WE CHOOSE THE PERCENTAGE. Fabio, 22 Nov: "I said 20% is
                    editable WE choose and WE find a lender - here lender does
                    not dictate this." So it sits on the column, on the deal. */}
                {c.id === 'previous_plus_growth' && (
                  <span className="mt-1.5 flex items-center justify-end gap-1.5 text-[12px] text-muted">
                    plus
                    <input value={pct} onChange={e => onPct(e.target.value)} inputMode="numeric"
                      className="w-[46px] rounded-md border border-field-line bg-card px-1.5 py-[3px]
                                 text-right text-[12.5px] font-bold text-ink" />
                    %
                  </span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* WHAT WAS LEFT OUT, EVERY TIME. Nobody should wonder whether a policy
          was forgotten. */}
      {leftOut(earlier, latest) && (
        <p className="m-0 border-t border-waiting-edge bg-waiting-bg px-3.5 py-2.5 text-[12.5px] leading-snug text-body">
          <b className="text-waiting">Not shown:</b> {leftOut(earlier, latest)}
        </p>
      )}
    </div>
  )
}

// --- turning documents into the two years -----------------------------------

function yearFrom(docs: ReadDocument[], fy: string): Year {
  const y: any = { fy, salary: 0, netProfit: 0, depreciation: 0, interest: 0,
    superannuation: 0, oneOff: 0, other: 0 }
  for (const d of docs) {
    if (d.kind === 'trust_return' || d.kind === 'partnership_return' || d.kind === 'unknown') continue
    // THE FINANCIALS BEAT THE COMPANY RETURN where both are there: the
    // add-backs are in the financials and the return does not show them.
    if (d.kind === 'company_return' && docs.some(o => o.kind === 'company_financials')) continue
    for (const row of d.years || []) {
      if (row.fy !== fy) continue
      for (const l of LINES) y[l.key] += n((row as any)[l.key])
    }
  }
  return y as Year
}

function yearPatch(slot: 1 | 2, y: Year): Record<string, string> {
  const p = slot === 1 ? 'seYear1' : 'seYear2'
  const out: Record<string, string> = { [`${p}FY`]: y.fy }
  const names: Record<string, string> = {
    salary: 'Salary', netProfit: 'NetProfit', depreciation: 'Depreciation',
    interest: 'Interest', superannuation: 'Super', oneOff: 'OneOff', other: 'Other',
  }
  for (const l of LINES) out[`${p}${names[l.key]}`] = String(Math.round(n(y[l.key])) || '')
  return out
}

/** Drop whatever stopped the simple route, keeping everything it did read. */
function keepSimple(docs: ReadDocument[]): ReadDocument[] {
  const kept = docs.filter(d => d.kind !== 'trust_return' && d.kind !== 'partnership_return')
  if (kept.length !== docs.length) return kept
  // Two businesses: keep the first one only.
  const first = kept.find(d => d.kind === 'company_financials' || d.kind === 'company_return')
  const key = (d: ReadDocument) => d.abn || d.entityName.toLowerCase()
  return first ? kept.filter(d => !key(d) || key(d) === key(first)) : kept
}
