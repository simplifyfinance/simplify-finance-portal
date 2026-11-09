'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { readMoney, money } from '@/lib/money'
import { figuresToFill, type MissingFigure } from '@/lib/milestone-figures'

// THE FIGURES THAT ARE NOT ON THE DEAL, SAID WHERE SOMEBODY WILL SEE THEM.
//
// 9 Nov 2026. Kelly Twyford's formal approval. Fabio: "This one doesn't have
// the breakdown of the purchase numbers and for some reason I can't add the
// loan amount on it."
//
// The portal already knew. "The money block is left out - the loan amount is
// not on the deal" was on the screen, in red, at the BOTTOM, underneath a full
// preview of the email. He scrolled a formal approval and never reached it. A
// warning nobody reaches is not a warning.
//
// SO IT GOES AT THE TOP, AND IT CARRIES THE BOXES. Telling somebody a figure is
// missing and leaving them to find which screen owns it is half a message, and
// on a deal with no borrowing capacity at all there is no obvious screen to
// send them to.
//
// IT SAVES TO THE DEAL, NOT TO THE EMAIL. Same rule as the rate box further
// down this screen: a figure typed here is on the record, so the compliance,
// the LVR and the next email all say the same thing. Nothing in this portal
// lets a number live inside one email.
//
// AND IT DOES NOT BLOCK THE SEND. Sometimes an email with no money block is the
// right email. A warning that holds the send hostage only teaches people to
// work around warnings.

const BOX = 'w-[150px] border border-field-line rounded-lg px-2.5 py-1.5 text-[12.5px] ' +
            'bg-card text-ink tabular-nums outline-none focus:border-brand placeholder:text-faint'

export default function MissingFigures({ deal, templateId, onSaved }: {
  deal: any
  /** The final check-in prints no money block, so it is owed no figures.
    * Mirrors the one exception in lib/milestone-send.ts rather than keeping a
    * second opinion about which emails carry figures. */
  templateId?: string
  /** The parent re-reads the deal and rebuilds the preview. */
  onSaved?: (patch: any) => void
}) {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [problem, setProblem] = useState('')
  // WHAT THIS SCREEN HAS ALREADY SAVED. The deal handed down is a copy from
  // before the write, so without this a figure stays "missing" on screen after
  // it has gone in - and somebody types it twice.
  const [saved, setSaved] = useState<Record<string, any>>({})

  const missing: MissingFigure[] = templateId === 'final_checkin'
    ? [] : figuresToFill({ ...deal, ...saved })
  if (!missing.length) return null

  async function save(f: MissingFigure) {
    const typed = String(vals[f.key] ?? '').trim()
    if (!typed) return
    const n = readMoney(typed)
    // A DUTY OF ZERO IS AN ANSWER, a price or a loan of zero is not.
    if (n === null || n < 0 || (n === 0 && f.key !== 'duty')) {
      setProblem(`${f.label} does not read as an amount.`); return
    }
    setBusy(f.key); setProblem('')
    const err = await checkedWrite(
      createSupabaseBrowser().from('deals').update({ [f.column]: n }).eq('id', deal.id),
      f.label)
    setBusy('')
    if (err) { setProblem(err); return }
    setSaved(x => ({ ...x, [f.column]: n }))
    onSaved?.({ [f.column]: n })
  }

  const words = missing.map(f => f.words)
  const list = words.length === 1 ? words[0]
    : words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1]

  return (
    <div className="mx-5 mt-4 bg-chase-bg border border-chase-edge rounded-xl px-4 py-3.5">
      <p className="text-[13.5px] font-bold text-chase m-0 mb-1.5">
        This email will go out with no figures in it.
      </p>
      <p className="text-[13px] text-body leading-[1.55] m-0">
        {list.charAt(0).toUpperCase() + list.slice(1)}{' '}
        {words.length === 1 ? 'is' : 'are'} not recorded on this deal. The breakdown is held back
        rather than printed with a hole in it — type what is missing and it goes in.
      </p>

      <div className="flex flex-wrap gap-4 mt-3">
        {missing.map(f => (
          <div key={f.key}>
            <p className="text-[10px] font-bold tracking-[.08em] uppercase text-muted m-0 mb-1">
              {f.label}
            </p>
            <div className="flex items-center gap-1.5">
              <input value={vals[f.key] ?? ''} inputMode="decimal"
                onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                onBlur={() => void save(f)}
                placeholder={f.key === 'duty' ? '0 if exempt' : 'amount'}
                className={BOX} />
              {busy === f.key && <span className="text-[11px] text-faint">saving…</span>}
              {busy !== f.key && readMoney(vals[f.key]) !== null && (
                <span className="text-[11px] text-faint">{money(vals[f.key])}</span>
              )}
            </div>
            <p className="text-[11px] text-muted leading-[1.45] m-0 mt-1 max-w-[230px]">{f.why}</p>
          </div>
        ))}
      </div>

      {problem && <p className="text-[12px] text-chase m-0 mt-2.5 leading-[1.5]">{problem}</p>}

      <p className="text-[11px] text-faint leading-[1.5] m-0 mt-3">
        Saved to the deal, not to this email — the compliance, the LVR and the next email all read
        the same figure. You can still send without the breakdown.
      </p>
    </div>
  )
}
