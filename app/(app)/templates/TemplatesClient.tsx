'use client'
import { useState } from 'react'
import { TONE } from '@/lib/tone'
import RefinanceTemplateForm from './RefinanceTemplateForm'
import SimpleTemplateForm from './SimpleTemplateForm'
import { buildNegativeGearingEmail } from '@/lib/negative-gearing-email'
import { buildPriceOpportunityEmail } from '@/lib/price-opportunity-email'

// Each card says what the email does and, plainly, what it will ask for. A
// template that needs six loan figures and one that needs none should not look
// like the same amount of work.
//
// Adding a template is an entry here plus a builder in lib/. Anything that needs
// only the client reuses SimpleTemplateForm rather than getting its own copy.
const TEMPLATES = [
  {
    id: 'refinance',
    name: 'Refinance saving',
    blurb: 'A client could move to a lower rate. Calculates the saving and shows what it means over ' +
           'the term. Owner-occupier and investor versions.',
    needs: 'loan figures',
    needsTail: '— balance, rates, term, cashback',
  },
  {
    id: 'negative-gearing',
    name: 'Negative gearing',
    blurb: 'The rules changed for established property bought after 12 May 2026. Explains that the ' +
           'losses are deferred rather than lost, and invites a conversation.',
    needs: 'the client only',
    needsTail: '— no figures',
  },
  {
    id: 'price-opportunity',
    name: 'Price beats the tax refund',
    blurb: 'The same house, valued $85,000 apart eight weeks either side of the Budget. Argues that ' +
           'a better purchase price is worth nine to ten years of the tax benefit everyone is ' +
           'mourning.',
    needs: 'the client only',
    needsTail: '— no figures',
  },
] as const

type Id = typeof TEMPLATES[number]['id']

export default function TemplatesClient() {
  const [chosen, setChosen] = useState<Id | null>(null)
  const current = TEMPLATES.find(t => t.id === chosen) || null

  if (!current) {
    return (
      <div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
        {TEMPLATES.map(t => (
          <button key={t.id} onClick={() => setChosen(t.id)}
            className="text-left border rounded-xl px-4 py-4 bg-white transition hover:border-[#BFE2F5]"
            style={{ borderColor: TONE.line }}>
            <span className="inline-block text-[10px] font-bold tracking-[.05em] uppercase rounded-full px-2 py-[2px] border mb-2"
                  style={{ borderColor: TONE.accentLine, color: TONE.accent, background: '#fff' }}>Ready</span>
            <div className="text-[14.5px] font-[620] mb-1" style={{ color: TONE.ink }}>{t.name}</div>
            <div className="text-[12.5px] leading-[1.55] mb-1.5" style={{ color: TONE.body }}>{t.blurb}</div>
            <div className="text-[11.5px]" style={{ color: TONE.label }}>
              Needs <b style={{ color: TONE.ink }}>{t.needs}</b> {t.needsTail}
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-[12.5px] mb-3.5" style={{ color: TONE.label }}>
        <button onClick={() => setChosen(null)} style={{ color: TONE.accent }}>&larr; All templates</button>
        <span>/</span>
        <span style={{ color: TONE.ink, fontWeight: 600 }}>{current.name}</span>
      </div>
      {chosen === 'refinance' && <RefinanceTemplateForm />}
      {chosen === 'negative-gearing' && <SimpleTemplateForm build={buildNegativeGearingEmail} />}
      {chosen === 'price-opportunity' && <SimpleTemplateForm build={buildPriceOpportunityEmail} />}
    </div>
  )
}
