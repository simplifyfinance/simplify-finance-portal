'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  SETTLEMENT_DEFAULTS, settlementSettings, isDefault, type SettlementSettings,
} from '@/lib/settlement-settings'
import { STEPS, STEP_LABEL, STEP_MEANS, type Step } from '@/lib/the-seven-steps'

// EVERY NUMBER IN THE SETTLEMENTS PROCESS, ON ONE PAGE.
//
// 17 Nov 2026, Fabio: "let's build a whole section in settings that these all
// can be changed as we see fit. Again, this is going to be a test and trial and
// error."
//
// Every one of these is a guess until Julian and Belle have run a month on
// them, and a guess that needs a ship to change is a guess nobody adjusts.
//
// AN EMPTY PAGE CHANGES NOTHING. Every read falls back to the default beside
// it, so a portal nobody has configured behaves exactly as it would with no
// settings page at all. See lib/settlement-settings.ts.

const lab = 'text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted'

function Row({ name, what, value, onChange, unit, dflt, off }: {
  name: string; what: string; value: number | null
  onChange: (v: number | null) => void
  unit: string; dflt: number | null; off?: boolean
}) {
  const changed = value !== dflt
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0">
      <span className="min-w-[160px] text-[13.5px] font-semibold">{name}</span>
      <span className="min-w-[200px] flex-1 text-[12.5px] leading-snug text-muted">{what}</span>
      {off && value === null ? (
        <button type="button" onClick={() => onChange(5)}
          className="rounded-[9px] border border-field-line bg-card px-3 py-1.5 text-[12.5px] font-semibold text-muted">
          never chased
        </button>
      ) : (
        <span className="flex flex-none items-center gap-2">
          <input value={value === null ? '' : String(value)} inputMode="numeric"
            onChange={e => {
              const raw = e.target.value.trim()
              onChange(raw === '' ? null : Number(raw.replace(/[^0-9]/g, '')))
            }}
            className={`w-[58px] rounded-[9px] border px-2.5 py-1.5 text-center text-[14px] font-semibold ${
              changed ? 'border-brand-ink bg-info-bg text-brand-ink' : 'border-field-line bg-card'}`} />
          <span className="w-[86px] text-[12.5px] text-muted">{unit}</span>
          {off && (
            <button type="button" onClick={() => onChange(null)} title="Never chase this step"
              className="text-[11.5px] text-faint underline">off</button>
          )}
        </span>
      )}
      <span className={`w-[88px] whitespace-nowrap text-right text-[11.5px] ${
        changed ? 'text-brand-ink' : 'text-faint'}`}>
        default <b>{dflt === null ? 'off' : dflt}</b>
      </span>
    </div>
  )
}

export default function SettlementSettingsPane() {
  const supabase = createSupabaseBrowser()
  const [s, setS] = useState<SettlementSettings>(SETTLEMENT_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    supabase.from('settings').select('settlements').eq('id', 'singleton').maybeSingle()
      .then(({ data }: any) => {
        if (!alive) return
        setS(settlementSettings(data?.settlements))
        setLoading(false)
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chase = (step: Step, v: number | null) =>
    setS(prev => ({ ...prev, chase: { ...prev.chase, [step]: v } }))
  const set = (k: keyof SettlementSettings, v: number | null) =>
    setS(prev => ({ ...prev, [k]: v === null ? 0 : v }))

  async function save(next: SettlementSettings = s) {
    setBusy(true); setMsg('')
    // RLS refuses a write by returning no rows and no error.
    const { data, error } = await supabase.from('settings')
      .update({ settlements: next }).eq('id', 'singleton').select('id')
    setBusy(false)
    if (error || !data?.length) {
      setMsg(error?.message || 'That was not saved — nothing reached the database.')
      return
    }
    setMsg('Saved')
  }

  // NO "LOADING..." LINE. The pane starts on the defaults and the saved numbers
  // arrive a moment later, so there is nothing to wait for and nothing to
  // flicker. What IS guarded is Save: until the row is back, saving would write
  // the defaults over whatever is already stored.

  return (
    <div className="rounded-2xl border border-card-line bg-card px-6 py-5">
      <div className="text-[20px] font-semibold">Settlements</div>
      <p className="mb-6 mt-1 max-w-[700px] text-[13.5px] leading-relaxed text-muted">
        How long each step may sit before the portal chases it, and when the dated work falls due.
        Changing a number here changes the board, the deal panel and the morning list together.
      </p>

      <div className="mb-7">
        <div className={lab}>How long a step may sit</div>
        <p className="mb-3 mt-1 max-w-[700px] text-[12.5px] leading-relaxed text-faint">
          Counted in business days on the New South Wales calendar, public holidays included, so a long
          weekend does not make the whole book look neglected.
        </p>
        {STEPS.filter(x => x !== 'settled').map(step => (
          <Row key={step} name={STEP_LABEL[step]} what={STEP_MEANS[step]}
            value={s.chase[step]} onChange={v => chase(step, v)}
            unit="business days" dflt={SETTLEMENT_DEFAULTS.chase[step]} off />
        ))}
      </div>

      <div className="mb-7">
        <div className={lab}>Work with a date on it</div>
        <p className="mb-3 mt-1 max-w-[700px] text-[12.5px] leading-relaxed text-faint">
          These are not chases. They fall due on a day, and they appear on the morning list with that
          date against them.
        </p>
        <Row name="Settlement numbers" what="The funds breakdown goes to the client before settlement."
          value={s.numbersDaysBefore} onChange={v => set('numbersDaysBefore', v)}
          unit="days before" dflt={SETTLEMENT_DEFAULTS.numbersDaysBefore} />
        <Row name="Shortfall check" what="The contribution is checked ahead of the day, and again on the day."
          value={s.shortfallDaysBefore} onChange={v => set('shortfallDaysBefore', v)}
          unit="days before" dflt={SETTLEMENT_DEFAULTS.shortfallDaysBefore} />
        <Row name="The check-in call" what="The month-in call and the four checks."
          value={s.checkInDaysAfter} onChange={v => set('checkInDaysAfter', v)}
          unit="days after" dflt={SETTLEMENT_DEFAULTS.checkInDaysAfter} />
        <Row name="The review request" what="A few days after the check-in, and only where they have not already left one."
          value={s.reviewDaysAfter} onChange={v => set('reviewDaysAfter', v)}
          unit="days after" dflt={SETTLEMENT_DEFAULTS.reviewDaysAfter} />
      </div>

      <div className="mb-6">
        <div className={lab}>The board&rsquo;s own clocks</div>
        <p className="mb-3 mt-1 max-w-[700px] text-[12.5px] leading-relaxed text-faint">
          These already exist and already run. They are here because they are the same kind of number
          and nobody should have to remember which screen a day lives behind.
        </p>
        <Row name="Gone quiet" what="Nothing recorded against the deal for this long."
          value={s.quietBusinessDays} onChange={v => set('quietBusinessDays', v)}
          unit="business days" dflt={SETTLEMENT_DEFAULTS.quietBusinessDays} />
        <Row name="Settling soon" what="The deal is this close to its settlement date."
          value={s.settlingSoonDays} onChange={v => set('settlingSoonDays', v)}
          unit="business days" dflt={SETTLEMENT_DEFAULTS.settlingSoonDays} />
        <Row name="Funds to complete" what="On a purchase, funds not checked this close to settling."
          value={s.fundsToCompleteDays} onChange={v => set('fundsToCompleteDays', v)}
          unit="business days" dflt={SETTLEMENT_DEFAULTS.fundsToCompleteDays} />
      </div>

      <div className="rounded-xl border border-info-edge border-l-[4px] border-l-brand-ink bg-info-bg px-4 py-3 text-[13px] text-body">
        <b className="text-brand-ink">An empty setting behaves exactly as today.</b> Every number here
        falls back to the default in the code, so nothing breaks if nobody ever opens this page.
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="button" onClick={() => void save()} disabled={busy || loading}
          className="rounded-[10px] bg-ink px-5 py-2 text-[13.5px] font-bold text-page disabled:opacity-40">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" disabled={busy || loading || isDefault(s)}
          onClick={() => { setS(SETTLEMENT_DEFAULTS); void save(SETTLEMENT_DEFAULTS) }}
          className="rounded-[10px] border border-field-line bg-card px-4 py-2 text-[13px] font-semibold text-muted disabled:opacity-40">
          Put everything back to default
        </button>
        <span className="text-[12.5px] text-faint">{msg}</span>
      </div>
    </div>
  )
}
