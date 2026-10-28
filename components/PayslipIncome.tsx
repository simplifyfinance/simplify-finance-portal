'use client'
import { useMemo, useState, type ReactNode } from 'react'
import DropZone from '@/components/DropZone'
import { assess, type PayLine, type PayKind } from '@/lib/annualise-income'
import type { ReadPayslip, ReadLine } from '@/lib/payslip-lines'
import { toFactFind, unsettled, whatHappened, type Fields, type Column } from '@/lib/income-to-fact-find'

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

  const a = useMemo(() => latest && latest.read.periodEnd ? assess({
    lines: lines as PayLine[],
    to: new Date(`${latest.read.periodEnd}T00:00:00`),
    employmentStart: employmentStart ? new Date(`${employmentStart}T00:00:00`) : null,
    kind: kindOf(employmentBasis),
  }) : null, [latest, lines, employmentStart, employmentBasis])

  const waiting = unsettled(lines)
  const noBreakdown = Boolean(latest && !latest.read.linesHaveYtd)
  const noPeriodEnd = Boolean(latest && !latest.read.periodEnd)

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

      {noBreakdown && !noPeriodEnd && (
        <Note tone="chase" head="This payslip does not split its year to date.">
          It shows one gross figure{latest?.read.ytdGross ? ` of ${money(latest.read.ytdGross)}` : ''} and
          no line by line year to date. There is no honest way to tell how much of that is base, overtime
          or bonus, and splitting it by this period&rsquo;s proportions would be making the numbers up.
          <b className="block mt-1">Ask for a payslip that shows year to date per line, or type the six
            boxes by hand.</b>
        </Note>
      )}

      {a && !noBreakdown && !noPeriodEnd && (
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
                <th className={`${th} text-right`} style={{ width: '13%' }}>Year to date</th>
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
                      <span className="block text-[12px] text-faint mt-0.5">{l.label}</span>
                    </td>
                    <td className={num}>{money(l.ytd)}</td>
                    <td className={num}>
                      {l.refused !== null && (
                        <span className="block text-faint line-through font-normal">{money(l.refused)}</span>
                      )}
                      {l.notIncome ? '—' : money(l.full)}
                    </td>
                    <td className={`${num} bg-waiting-bg text-waiting`}>
                      {l.notIncome ? '—' : money(l.shaded)}
                    </td>
                    <td className={td}>
                      {why(l)}
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
                <td className={`${num} border-b-0 pt-3`} />
                <td className={`${num} border-b-0 pt-3 text-[15px]`}>{money(a.totals.full)}</td>
                <td className={`${num} border-b-0 pt-3 text-[15px] bg-waiting-bg text-waiting`}>{money(a.totals.shaded)}</td>
                <td className={`${td} border-b-0 pt-3 text-faint`}>
                  The {money(a.totals.variable)} between them is the variable part of this income.
                </td>
              </tr>
            </tbody>
          </table>

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

function why(l: { key: string; oneOff: boolean; notIncome: boolean; refused: number | null; ytd: number }): string {
  if (l.notIncome) return 'Money handed back, not money earned. Out of both columns.'
  if (l.oneOff) {
    return l.refused
      ? `Not annualised. Paid once — spreading it across the year claimed ${money(l.refused)} of a ${money(l.ytd)} payment.`
      : 'Not annualised. Paid once, so it is taken at what was actually paid.'
  }
  if (l.key === 'base') return 'Contracted, same every pay. Never shaded by anyone.'
  if (l.key === 'allowance') return 'Paid every period and part of the package. Not shaded.'
  if (l.key === 'overtime') return 'Regular and ongoing, so it counts. Some lenders take it in full — that is the left column.'
  if (l.key === 'commission') return 'Paid again and again, however lumpy.'
  return 'Counted, and shaded, until somebody says otherwise.'
}
