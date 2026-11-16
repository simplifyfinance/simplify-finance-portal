'use client'
import { FileText, LineChart, Calculator, Home, ShieldCheck, History } from 'lucide-react'
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
  FileNotes: History,
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
  // THE SIXTH, 29 Oct 2026. Catherine, item 6: a record of our conversations
  // with a client. It is the File update log full screen - the same rows, not a
  // second store - with room to read a year of them and an export for an audit.
  { key: 'FileNotes', label: 'File notes' },
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

  // SIX COLUMNS, AND THEY REACH THE EDGE.
  //
  // 16 Nov 2026. This grid was six columns PLUS a seventh at 1.45fr, held for
  // the Next action box that sat beside them. That box was taken off the same
  // day - it said what the head of the deal already said - and the column it
  // used to sit in stayed behind as a gap on the right. Fabio: "that blank
  // hole on the right is useless lost space."
  //
  // The tiles stretch to the same height too, so a two-line name no longer
  // leaves the tile beside it short.
  return (
    <div className="grid grid-cols-6 items-stretch gap-2.5 mb-2.5 max-[1300px]:grid-cols-4 max-[1100px]:grid-cols-3 max-[700px]:grid-cols-2">
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
          // OFF-WHITE, NOT WHITE - docs/approved-looks/deal-page-stages.html.
          // Fabio, 16 Nov 2026: "the little boxes where fact find etc are, it
          // should be off white." They sit INSIDE the Where it is box, and a
          // white tile on a white box has nothing holding it.
          <button key={key} onClick={() => onPick(key)} aria-label={label}
            className={`text-left border rounded-[11px] px-3 py-[11px] transition-colors
              flex flex-col ${
              on ? 'border-brand bg-info-bg shadow-[inset_0_0_0_1px_var(--color-brand)]'
                 : 'bg-page border-card-line hover:border-brand'}`}>
            <span className={`w-[25px] h-[25px] rounded-lg flex items-center justify-center mb-2 ${
              on ? 'bg-info-bg text-info' : 'bg-line-soft text-faint'}`}>
              <Icon size={14} strokeWidth={1.9} />
            </span>
            <span className="block text-[12.5px] font-[650] text-ink leading-[1.25]">{label}</span>
            {line && <span className={`block text-[11px] mt-auto pt-[3px] ${tone}`}>{line}</span>}
          </button>
        )
      })}

      {/* THE NEXT ACTION BOX IS GONE - 16 Nov 2026.
          It read "Waiting on: Mellissa Sedin to complete BC" while the head of
          the deal said the same thing two inches above it, and the board said
          it a third time with a whole column. One fact, drawn three times.
          It is on the GONE list in
          lib/nothing-on-the-deal-page-is-lost.test.ts with the reason. */}
    </div>
  )
}
