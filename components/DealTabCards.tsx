'use client'
import { FileText, LineChart, Calculator, Home, ShieldCheck } from 'lucide-react'
import { dealBeads } from '@/lib/deal-status'

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
  const tabs = DEAL_TABS

  return (
    <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-2.5 mb-2.5 max-[900px]:grid-cols-2">
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
    </div>
  )
}
