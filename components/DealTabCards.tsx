'use client'
import { FileText, LineChart, Calculator, Home, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { dealBeads, getWaitingOnLabel } from '@/lib/deal-status'
import { stageSince, stageAge } from '@/lib/deal-age'

// THE FIVE TABS, AS CARDS.
//
// Straight out of one-inside-the-deal-v4.html, which is the look Fabio signed
// off: a card per tab, an icon in a rounded square, the name, and one line
// underneath saying where that tab is up to. It replaces a row of five pill
// buttons that said nothing but their own name.
//
// NOTHING HERE IS INVENTED. The line underneath is read from dealBeads(), the
// same ladder the stage bar and the board chip already use, so a card and the
// bar can never disagree. Statements has no bead - there is no column that says
// whether statements have been looked at - so it carries no line rather than a
// guessed one.

const ICON: Record<string, any> = {
  FactFind: FileText, Statements: LineChart, BC: Calculator, LO: Home, Compliance: ShieldCheck,
}

// Which bead speaks for which tab. Statements is deliberately absent.
const BEAD: Record<string, string> = {
  FactFind: 'fact_find', BC: 'bc', LO: 'lo', Compliance: 'compliance',
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// The tabs, named once. The presence row reads the same list, so the circle
// beside somebody's name and the card they are on can never disagree.
export const DEAL_TABS = [
  { key: 'FactFind', label: 'Fact Find' },
  { key: 'Statements', label: 'Statements' },
  { key: 'BC', label: 'BC — Borrowing capacity' },
  { key: 'LO', label: 'Lending options' },
  { key: 'Compliance', label: 'Compliance' },
]

export default function DealTabCards({ deal, stage, onPick }: {
  deal: any
  stage: string
  onPick: (key: string) => void
}) {
  const beads = dealBeads(deal)

  // THE OFFICER'S NAME, ASKED FOR HERE RATHER THAN HANDED DOWN.
  //
  // The deal carries an id. The name used to be handed up to the page by the
  // Reassign box, and that setState landed a moment after the deal loaded -
  // re-rendering the form somebody was typing into. The robot caught a note
  // that "survived on screen but never reached the database". Nothing above
  // this component moves now; the box that wants the name goes and gets it.
  const [officer, setOfficer] = useState('')
  const officerId = deal?.assigned_credit_officer || ''
  useEffect(() => {
    if (!officerId) { setOfficer(''); return }
    let alive = true
    const supabase = createSupabaseBrowser()
    supabase.from('credit_officers').select('name').eq('id', officerId).maybeSingle()
      .then(({ data }) => { if (alive && data?.name) setOfficer(data.name) })
    return () => { alive = false }
  }, [officerId])
  const tabs = DEAL_TABS

  return (
    <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.45fr)] gap-2.5 mb-2.5 max-[1100px]:grid-cols-3 max-[700px]:grid-cols-2">
      {tabs.map(({ key, label }) => {
        const Icon = ICON[key]
        const bead = BEAD[key] ? beads.find(b => b.key === BEAD[key]) : undefined
        const on = stage === key

        // done, being worked on, or not begun - in that order.
        let line = '', tone = 'text-faint'
        if (bead?.done) { line = 'Complete'; tone = 'text-done font-semibold' }
        else if (bead?.current) {
          line = sentence(bead.state || 'not started')
          tone = bead.state && bead.state !== 'not started' ? 'text-info font-semibold' : 'text-faint'
        } else if (bead) { line = 'Not started' }

        return (
          // THE CARD IS STILL CALLED BY ITS TAB NAME.
          //
          // 5 Oct 2026. Turning the tab row into cards put a status line inside
          // the button, so the button's name became "Compliance Not started" and
          // six browser specs that click /^Compliance$/ sat waiting until they
          // timed out. The name is stated here; the line underneath is still
          // read by anybody looking at the screen.
          <button key={key} onClick={() => onPick(key)} aria-label={label}
            className={`text-left bg-card border rounded-[11px] px-3 py-[11px] transition-colors ${
              on ? 'border-brand bg-info-bg shadow-[inset_0_0_0_1px_var(--color-brand)]' : 'border-card-line hover:border-brand'}`}>
            <span className="w-7 h-7 rounded-lg bg-gray-100 text-muted flex items-center justify-center mb-2">
              <Icon size={15} strokeWidth={1.9} />
            </span>
            <span className="block text-[12.5px] font-[650] text-ink leading-[1.25]">{label}</span>
            {line && <span className={`block text-[11px] mt-[3px] ${tone}`}>{line}</span>}
          </button>
        )
      })}

      {/* NEXT ACTION. The sentence is the one the deals board already shows for
          this deal, and the date is the one it already ages it by - so a card,
          the board and this box can never say three different things. It draws
          itself away when there is nothing to say. */}
      {(() => {
        const waiting = getWaitingOnLabel(deal, officer)
        if (!waiting) return null
        const since = stageSince(deal)
        const age = stageAge(deal)
        return (
          <div className="text-left bg-card border border-card-line rounded-[11px] px-3 py-[11px]">
            <span className="block text-[9.5px] font-bold tracking-[.09em] uppercase text-faint mb-1.5">
              Next action
            </span>
            <span className="block text-[12.5px] font-[650] text-ink leading-[1.3]">{waiting.text}</span>
            {since && age.days !== null && (
              <span className="block text-[11px] text-faint mt-[3px]">
                Waiting {age.label === 'today' ? 'since today' : age.label}
              </span>
            )}
          </div>
        )
      })()}
    </div>
  )
}
