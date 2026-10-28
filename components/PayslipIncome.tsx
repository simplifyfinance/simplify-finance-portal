'use client'
import { useMemo, useState, type ReactNode } from 'react'
import DropZone from '@/components/DropZone'
import { assess, type PayLine, type PayKind } from '@/lib/annualise-income'
import type { ReadPayslip, ReadLine } from '@/lib/payslip-lines'
import { toFactFind, unsettled, whatHappened, type Fields, type Column } from '@/lib/income-to-fact-find'
import { assessCombined, annualFromRate, type BaseRate } from '@/lib/combined-ytd'

// WHAT A PAYSLIP SAYS THIS PERSON EARNS IN A YEAR, ON THE SCREEN.
//
// 28 Oct 2026. The last piece. Everything it knows is in three tested files and
// none of it is in here:
//
//   lib/annualise-income.ts    the arithmetic and the three-month rule
//   lib/payslip-lines.ts       what each line on a payslip means
//   lib/income-to-fact-find.ts which of the six boxes each figure lands in
//
// THIS FILE DRAWS AND ASKS. That is deliberate. A rule living in a component is
// a rule nothing can test and nothing downstream can share, and every figure on
// this screen ends up on a lender's servicing sheet.
//
// 100% AND 80%, FIXED. There is no control for the percentage and there is no
// setting for it. Fabio, 28 Oct 2026: "EVERY time we annualise income outside of
// base income you give my credit team 2 options 80% and 100% SO WE CAN DECIDE
// you dont need per lender breakdown I was very clear." An earlier version of
// this file had a box you could type a percentage into. That is a third thing
// to decide on a screen whose whole job is to leave the deciding to a person
// with a lender in front of them.
//
// IT NEVER PICKS A COLUMN. Full and at 80%, side by side, no lender named -
// because no lender is known while a fact find is being filled in. Fabio: "that
// covers all lenders and that is a credit decision later on so keep it simple."
//
// AND IT TOUCHES NOTHING UNTIL THE PRESS. Dropping a payslip changes no field.
// The six boxes underneath stay exactly as they were until somebody presses one
// of the two buttons, and then the file says which one and what the other said.

const KIND_WORDS: Record<PayKind, string> = {
  permanent: 'permanent', casual: 'casual', contract: 'contract',
}

/** What the fact find calls the job, turned into what a lender asks of it. */
export function kindOf(basis: string): PayKind {
  const s = String(basis || '').toLowerCase()
  if (s.includes('casual')) return 'casual'
  if (s.includes('contract')) return 'contract'
  return 'permanent'
}

type Override = 'base' | 'allowance' | 'overtime' | 'commission' | 'oneOff' | 'notIncome'

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-AU')

// Oldest first, so the last one in the list is the latest. A payslip with no
// period end printed sorts to the front rather than silently becoming the one
// everything is read from.
const byPeriod = (x: { read: ReadPayslip }, y: { read: ReadPayslip }) =>
  String(x.read.periodEnd || '').localeCompare(String(y.read.periodEnd || ''))
const theDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

export default function PayslipIncome({
  employerName, employmentBasis, employmentStart, onUse,
}: {
  employerName: string
  employmentBasis: string
  employmentStart: string
  onUse: (fields: Fields, note: string) => void
}) {
  const [slips, setSlips] = useState<Array<{ name: string; read: ReadPayslip }>>([])
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState('')
  const [essential, setEssential] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [used, setUsed] = useState<Column | null>(null)
  // THE BASE, WHERE THE PAYSLIP GIVES ONE COMBINED YEAR TO DATE.
  //
  // Read off the payslip where the employer printed it, and typed in where
  // they did not. It is the one fact that method cannot do without, so it is
  // always on screen and always editable - a figure a credit assessor cannot
  // see is a figure they cannot check.
  const [baseTyped, setBaseTyped] = useState('')
  // FOLDED BY DEFAULT. It is complete and it is one press away; sitting in the
  // middle of the screen on every file is what made this a wall of text.
  const [showWorking, setShowWorking] = useState(false)
  const [basisTyped, setBasisTyped] = useState<BaseRate['basis']>('annual')

  async function read(files: File[]) {
    setBusy(true); setTrouble('')
    const got: Array<{ name: string; read: ReadPayslip }> = []
    const failed: string[] = []
    for (const file of files) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = () => reject(new Error('could not be opened'))
          reader.readAsDataURL(file)
        })
        const res = await fetch('/api/read-payslip', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        })
        const data = await res.json()
        if (data?.error || !data?.payslip) failed.push(`${file.name} — ${data?.error || 'nothing came back'}`)
        else got.push({ name: file.name, read: data.payslip })
      } catch (e: any) {
        failed.push(`${file.name} — ${e?.message || 'could not be read'}`)
      }
    }
    // Keeps what it managed to read even where one of several failed. A reader
    // that throws the lot away because the third file was a photo is a reader
    // somebody stops using.
    if (got.length) setSlips(s => [...s, ...got].sort(byPeriod))
    if (failed.length) setTrouble(failed.join('  ·  '))
    setUsed(null)
    setBusy(false)
  }

  // THE LATEST PAYSLIP IS THE ONE THAT COUNTS. Its year to date already holds
  // everything the earlier ones hold - that is what a year to date IS - so
  // adding two payslips together would count the year twice. The earlier ones
  // are listed because a lender asks to see two, not because they are summed.
  const latest = slips.length ? slips[slips.length - 1] : null

  const lines: ReadLine[] = useMemo(() => (latest?.read.lines || []).map(l => {
    const o = overrides[l.label]
    if (!o) return l
    if (o === 'oneOff') return { ...l, oneOff: true, notIncome: false, recognised: true }
    if (o === 'notIncome') return { ...l, notIncome: true, recognised: true }
    return { ...l, key: o, oneOff: false, notIncome: false, recognised: true }
  }), [latest, overrides])

  const noBreakdown = Boolean(latest && !latest.read.linesHaveYtd)
  const noPeriodEnd = Boolean(latest && !latest.read.periodEnd)

  // WHAT THE BASE IS, IN A YEAR.
  //
  // What somebody typed wins, because they are looking at the document. Else
  // the rate the payslip printed. Else the annual salary if it stated one.
  const baseFromSlip = useMemo(() => {
    if (!latest) return null
    const r = latest.read
    if (r.baseRate && r.baseRateBasis) return annualFromRate({ amount: r.baseRate, basis: r.baseRateBasis })
    return r.annualSalaryStated || null
  }, [latest])

  // Turning a rate into a year is arithmetic, so lib does it - even the annual
  // case, which looks like it needs no maths right up until somebody types
  // "209,325.17" and a stray rounding appears in one path and not the other.
  const typed = Number(String(baseTyped).replace(/[$,\s]/g, ''))
  const annualBase = annualFromRate({ amount: typed, basis: basisTyped }) || baseFromSlip || 0

  // TWO METHODS, ONE SHAPE OUT.
  //
  // 28 Oct 2026. The reader was built on the rule that each line carries its
  // own year to date. Two real payslips - a central bank and a state health
  // service - print full detail for the fortnight and ONE combined gross for
  // the year, so the first version refused both and the feature was useless on
  // the normal case.
  //
  // Fabio: "if each line has a year to date, you're going to do it one way. If
  // each line doesn't... you're going to annualize the income, exclude the base
  // salary, and then mark everything as non-base. But you're still going to
  // show, if I shade it for 80%, that's the income."
  //
  // Both roads end at the same two columns. See lib/combined-ytd.ts.
  const a = useMemo(() => {
    if (!latest || !latest.read.periodEnd) return null
    const to = new Date(`${latest.read.periodEnd}T00:00:00`)
    const employmentStarted = employmentStart ? new Date(`${employmentStart}T00:00:00`) : null
    const kind = kindOf(employmentBasis)
    if (!noBreakdown) {
      return assess({ lines: lines as PayLine[], to, employmentStart: employmentStarted, kind })
    }
    return assessCombined({
      ytdGross: latest.read.ytdGross || 0,
      annualBase,
      to, employmentStart: employmentStarted, kind,
    })
  }, [latest, lines, employmentStart, employmentBasis, noBreakdown, annualBase])

  // A line nobody has placed only blocks the line-by-line method. On the
  // combined one there are no lines to place.
  const waiting = noBreakdown ? [] : unsettled(lines)

  function press(column: Column) {
    if (!a) return
    onUse(toFactFind(a, column, { essentialOvertime: essential }),
      whatHappened(a, column, { payslips: slips.length }))
    setUsed(column)
  }

  const th = 'text-[11px] font-bold uppercase tracking-wider text-faint text-left pb-2 pr-3 border-b border-line-soft'
  const td = 'py-2.5 pr-3 text-[13px] text-gray-700 border-b border-line-soft align-top leading-snug'
  const num = `${td} text-right tabular-nums whitespace-nowrap font-semibold text-ink`
  const pill = 'text-[11px] font-bold rounded-full px-2 py-0.5 border'

  return (
    <div className="mb-4">
      <DropZone
        onFiles={read} accept="application/pdf" busy={busy} compact
        title="Drop payslips here"
        hint="PDF. The last two is what a lender asks for. Nothing is stored — it is read and the figures come back."
      />

      {trouble && (
        <p className="mt-2 text-[12.5px] text-chase">{trouble}</p>
      )}

      {slips.map((s, i) => (
        <div key={`${s.name}-${i}`} className="mt-2 flex items-baseline gap-3 border border-card-line rounded-lg px-3 py-2 text-[13px]">
          <span className="font-semibold text-ink">{s.name}</span>
          <span className="text-faint">
            {s.read.periodEnd
              ? `period ending ${theDate(new Date(`${s.read.periodEnd}T00:00:00`))}`
              : 'no period end printed'}
          </span>
          <span className="ml-auto text-[12px] text-faint">
            {s === latest ? 'latest — used below' : 'read'}
          </span>
        </div>
      ))}

      {noPeriodEnd && (
        <Note tone="chase" head="This payslip does not print the end of its pay period.">
          A year to date cannot be turned into a year without knowing what it is a year to date TO.
          Ask for a payslip that shows the pay period, or type the six boxes by hand.
        </Note>
      )}

      {/* ONE LINE, NOT FOUR. The explanation was true and nobody needed it
          every time - what they need is the figure and the box to correct it.
          The long version lives in lib/combined-ytd.ts, where it belongs. */}
      {noBreakdown && !noPeriodEnd && (
        <div className="mt-3 rounded-lg border border-info-edge bg-info-bg px-3.5 py-2.5 flex items-center gap-x-3 gap-y-2 flex-wrap text-[13px] text-[#1E5F7A]">
          <b className="text-[#13455B]">One year to date, not a line for each.</b>
          <span>
            {latest?.read.ytdGross ? `${money(latest.read.ytdGross)} gross` : 'One gross figure'}
            {' '}&mdash; base comes off, the rest is non-base.
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[12.5px]">Base</span>
            <input value={baseTyped} onChange={e => setBaseTyped(e.target.value)}
              placeholder={baseFromSlip ? money(baseFromSlip) : 'type it'}
              aria-label="Base rate"
              className="w-28 border border-info-edge rounded-md px-2 py-1 text-[13px] text-ink bg-card tabular-nums" />
            <select value={basisTyped} onChange={e => setBasisTyped(e.target.value as any)}
              aria-label="Base rate period"
              className="border border-info-edge rounded-md px-2 py-1 text-[13px] text-ink bg-card">
              <option value="annual">a year</option>
              <option value="monthly">a month</option>
              <option value="fortnightly">a fortnight</option>
              <option value="weekly">a week</option>
              <option value="hourly">an hour</option>
            </select>
            {annualBase <= 0 && (
              <span className="text-[12.5px] font-semibold">No base rate printed &mdash; type it.</span>
            )}
          </span>
        </div>
      )}

      {a && !noPeriodEnd && (
        <div className="mt-3 border border-line rounded-xl p-4 bg-card">
          <div className="flex items-baseline gap-2.5 flex-wrap mb-2">
            <b className="text-[14.5px] text-ink">{employerName || latest?.read.employer || 'This employer'}</b>
            <span className={`${pill} bg-info-bg text-brand-ink border-info-edge`}>
              PAYG · {KIND_WORDS[kindOf(employmentBasis)]}
            </span>
            {a.coverage.enough
              ? <span className={`${pill} bg-done-bg text-done border-done-edge`}>Enough year to date</span>
              : <span className={`${pill} bg-chase-bg text-chase border-chase-edge`}>Not enough year to date</span>}
            <span className="ml-auto text-[12.5px] text-faint">
              {a.coverage.days} days of {a.coverage.yearDays} · to {theDate(a.coverage.to)}
            </span>
          </div>

          {!a.coverage.enough && (
            <Note tone="chase" head="Not enough year to date to annualise.">
              {a.coverage.why}
            </Note>
          )}

          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th} style={{ width: '27%' }}>What is on the payslip</th>
                {/* A COLUMN OF NOUGHTS READS AS "THIS PERSON EARNED NOTHING".
                    On the combined method the payslip never gave a figure per
                    line, so there is nothing honest to put here. The total is
                    in the blue line above and in the working below. */}
                {!noBreakdown && <th className={`${th} text-right`} style={{ width: '13%' }}>Year to date</th>}
                <th className={`${th} text-right`} style={{ width: '13%' }}>Full</th>
                <th className={`${th} text-right text-waiting`} style={{ width: '15%' }}>At 80%</th>
                <th className={th}>Why</th>
              </tr>
            </thead>
            <tbody>
              {a.lines.map((l, i) => {
                const line = lines.find(x => x.label === l.label)
                const unknown = line?.recognised === false
                return (
                  <tr key={`${l.label}-${i}`}>
                    <td className={td}>
                      <b className="text-ink">{title(l.key, l.label)}</b>
                      {unknown && (
                        <span className={`${pill} bg-chase-bg text-chase border-chase-edge ml-1.5`}>Not recognised</span>
                      )}
                      {/* ONLY WHERE IT ADDS SOMETHING. "Base salary" under
                          "Base salary" is noise; "Ordinary Hours" under it is
                          what the payslip actually called it. */}
                      {title(l.key, l.label) !== l.label && (
                        <span className="block text-[12px] text-faint mt-0.5">{l.label}</span>
                      )}
                    </td>
                    {!noBreakdown && <td className={num}>{money(l.ytd)}</td>}
                    <td className={num}>
                      {l.refused !== null && (
                        <span className="block text-faint line-through font-normal">{money(l.refused)}</span>
                      )}
                      {l.notIncome ? '—' : money(l.full)}
                    </td>
                    <td className={`${num} bg-waiting-bg text-waiting`}>
                      {l.notIncome ? '—' : money(l.shaded)}
                    </td>
                    <td className={`${td} text-[13px] text-faint`}>
                      {whyShort(l)}
                      {unknown && (
                        <span className="flex gap-1.5 flex-wrap mt-1.5">
                          {(['allowance', 'overtime', 'commission', 'base'] as Override[]).map(o => (
                            <button key={o} type="button" onClick={() => setOverrides(x => ({ ...x, [l.label]: o }))}
                              className="text-[11.5px] font-semibold border border-field-line rounded px-2 py-0.5 hover:bg-info-bg">
                              {o === 'base' ? 'Base' : o === 'allowance' ? 'Allowance'
                                : o === 'overtime' ? 'Overtime' : 'Commission'}
                            </button>
                          ))}
                          <button type="button" onClick={() => setOverrides(x => ({ ...x, [l.label]: 'oneOff' }))}
                            className="text-[11.5px] font-semibold border border-field-line rounded px-2 py-0.5 hover:bg-info-bg">
                            Paid once
                          </button>
                          <button type="button" onClick={() => setOverrides(x => ({ ...x, [l.label]: 'notIncome' }))}
                            className="text-[11.5px] font-semibold border border-field-line rounded px-2 py-0.5 hover:bg-info-bg">
                            Not income
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td className={`${td} border-b-0 font-bold text-ink pt-3`}>What this person earns in a year</td>
                {!noBreakdown && <td className={`${num} border-b-0 pt-3`} />}
                <td className={`${num} border-b-0 pt-3 text-[15px]`}>{money(a.totals.full)}</td>
                <td className={`${num} border-b-0 pt-3 text-[15px] bg-waiting-bg text-waiting`}>{money(a.totals.shaded)}</td>
                <td className={`${td} border-b-0 pt-3 text-faint`}>
                  The {money(a.totals.variable)} between them is the variable part of this income.
                </td>
              </tr>
            </tbody>
          </table>

          {/* HOW IT GOT THERE, EVERY TIME.
              Fabio, 28 Oct 2026: "I want you to explain to credit how you got
              to that figure and show the maths every time." A credit assessor
              handed two totals and no working either takes them on trust or
              redoes them, and the second is what actually happens. */}
          {a.working.length > 0 && !showWorking && (
            <button type="button" onClick={() => setShowWorking(true)}
              className="mt-3 text-[13px] font-semibold text-brand-ink hover:underline">
              Show the working ↓
              <span className="font-normal text-faint">
                {'  '}{a.working.length} steps
              </span>
            </button>
          )}
          {a.working.length > 0 && showWorking && (
            <div className="mt-3 border border-line-soft rounded-lg bg-page px-3.5 py-3">
              <div className="flex items-baseline gap-2 mb-1.5">
                <button type="button" onClick={() => setShowWorking(false)}
                  className="text-[10px] font-bold uppercase tracking-wider text-brand-ink hover:underline">
                  Hide the working ↑
                </button>
                <span className={`${pill} bg-card text-faint border-line`}>
                  {a.method === 'combined'
                    ? 'One year to date, base taken off'
                    : 'A year to date on every line'}
                </span>
              </div>
              <ol className="list-decimal pl-5 space-y-1">
                {a.working.map((step, i) => (
                  <li key={i} className="text-[12.5px] text-gray-700 leading-snug">{step}</li>
                ))}
              </ol>
            </div>
          )}

          {a.lines.some(l => l.key === 'overtime') && (
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-gray-700">
              <span className="text-faint">Overtime goes in as</span>
              <button type="button" onClick={() => setEssential(false)}
                className={`font-semibold border rounded px-2 py-1 ${essential ? 'border-field-line text-faint' : 'border-brand-ink text-brand-ink bg-info-bg'}`}>
                Non-essential
              </button>
              <button type="button" onClick={() => setEssential(true)}
                className={`font-semibold border rounded px-2 py-1 ${essential ? 'border-brand-ink text-brand-ink bg-info-bg' : 'border-field-line text-faint'}`}>
                Essential services
              </button>
              <span className="text-faint">
                A payslip only says &ldquo;Overtime&rdquo;. Which one it is lives on the file, not on the payslip.
              </span>
            </div>
          )}

          {waiting.length > 0 && (
            <Note tone="chase" head={`${waiting.length === 1 ? 'One line has' : `${waiting.length} lines have`} no home yet.`}>
              {waiting.join(', ')} — say what {waiting.length === 1 ? 'it is' : 'they are'} above and the
              buttons open. There is no box on the fact find for a line nobody has placed, and putting it
              in the wrong one puts unshaded money on this file.
            </Note>
          )}

          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <button type="button" disabled={waiting.length > 0} onClick={() => press('full')}
              className="text-[13px] font-semibold rounded-lg px-3 py-2 bg-brand-ink text-page disabled:opacity-40">
              Put the full column on the fact find
            </button>
            <button type="button" disabled={waiting.length > 0} onClick={() => press('shaded')}
              className="text-[13px] font-semibold rounded-lg px-3 py-2 bg-waiting text-page disabled:opacity-40">
              Put the 80% column on the fact find
            </button>
            {used && (
              <span className="text-[12.5px] text-done font-semibold">
                {used === 'full' ? 'Full' : 'The 80%'} column written to the boxes below.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Note({ tone, head, children }: { tone: 'chase' | 'info'; head: string; children: ReactNode }) {
  const skin = tone === 'chase'
    ? 'bg-chase-bg border-chase-edge text-chase'
    : 'bg-info-bg border-info-edge text-brand-ink'
  return (
    <div className={`mt-3 mb-1 rounded-lg border px-3.5 py-2.5 text-[13px] leading-snug ${skin}`}>
      <b className="block mb-0.5">{head}</b>
      {children}
    </div>
  )
}

const TITLES: Record<string, string> = {
  base: 'Base salary', allowance: 'Allowance', overtime: 'Overtime',
  commission: 'Commission', bonus: 'Bonus', other: 'Other',
}
function title(key: string, label: string): string {
  return TITLES[key] || label
}

// TWO WORDS, NOT TWO SENTENCES.
//
// 28 Oct 2026. The Why column explained the rule in full on every row of every
// payslip. It was right, and after the second file nobody reads it. What a
// credit assessor needs from that column is whether this line was shaded. The
// reasoning is in the working, once, where somebody can go and find it.
function whyShort(l: { key: string; oneOff: boolean; notIncome: boolean; full: number; shaded: number }): string {
  if (l.notIncome) return 'Not income'
  if (l.oneOff) return 'Paid once, not annualised'
  return l.shaded === l.full ? 'Never shaded' : 'Shaded at 80%'
}
