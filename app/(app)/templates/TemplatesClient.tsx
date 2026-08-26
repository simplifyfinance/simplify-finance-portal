'use client'
import { useEffect, useState } from 'react'
import { TONE } from '@/lib/tone'
import RefinanceTemplateForm from './RefinanceTemplateForm'
import SimpleTemplateForm, { type ExtraField } from './SimpleTemplateForm'
import { buildNegativeGearingEmail } from '@/lib/negative-gearing-email'
import { buildPriceOpportunityEmail } from '@/lib/price-opportunity-email'
import { buildRebateEmail } from '@/lib/new-property-rebate-email'

// Each card says what the email does and, plainly, what it will ask for. A
// template needing six loan figures and one needing none should not look like
// the same amount of work.
//
// Adding a template is an entry here plus a builder in lib/. Anything that needs
// only the client — or the client and a field or two — reuses SimpleTemplateForm
// rather than getting its own copy.

const REBATE_FIELDS: ExtraField[] = [
  { key: 'rebate', label: 'Rebate passed back', placeholder: '15,000', required: true,
    hint: 'The only figure in the email. Leave the dollar sign out.' },
  { key: 'documentsUrl', label: 'Project documents link', placeholder: 'https://…',
    hint: 'Where the brochure and siting plan live. Leave blank and the button is left out.' },
]

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
    name: 'What if the tax change actually created an opportunity?',
    blurb: 'The same house, valued $85,000 apart eight weeks either side of the Budget. Argues that ' +
           'a better purchase price is worth nine to ten years of the tax benefit.',
    needs: 'the client only',
    needsTail: '— no figures',
  },
  {
    id: 'new-property-rebate',
    name: 'New property rebate',
    blurb: 'New stock keeps the negative gearing treatment established property has lost, and the ' +
           'developer rebate is passed straight back to the client.',
    needs: 'the client and a rebate amount',
    needsTail: '— plus a link to the project documents',
  },
] as const

type Id = typeof TEMPLATES[number]['id']

export default function TemplatesClient() {
  const [chosen, setChosen] = useState<Id | null>(null)
  const [archived, setArchived] = useState<string[]>([])
  const [busy, setBusy] = useState('')

  useEffect(() => {
    fetch('/api/template-archive')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.archived) setArchived(j.archived) })
      .catch(() => { /* the list still works, nothing is hidden */ })
  }, [])

  async function toggle(id: string, next: boolean) {
    setBusy(id)
    try {
      const res = await fetch('/api/template-archive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, archived: next }),
      })
      const j = await res.json()
      if (res.ok && j?.archived) setArchived(j.archived)
    } catch { /* leave the list as it was rather than lying about the state */ }
    setBusy('')
  }

  const current = TEMPLATES.find(t => t.id === chosen) || null

  if (current) {
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
        {chosen === 'new-property-rebate' && (
          <SimpleTemplateForm build={buildRebateEmail} extras={REBATE_FIELDS} extrasTitle="This project" />
        )}
      </div>
    )
  }

  const live = TEMPLATES.filter(t => !archived.includes(t.id))
  const away = TEMPLATES.filter(t => archived.includes(t.id))

  const card = (t: typeof TEMPLATES[number], isArchived: boolean) => (
    <div key={t.id} className="border rounded-xl px-4 py-4 relative"
         style={{ borderColor: TONE.line, background: isArchived ? TONE.zebra : '#fff',
                  opacity: isArchived ? .68 : 1 }}>
      <button onClick={() => toggle(t.id, !isArchived)} disabled={busy === t.id}
        className="absolute top-3 right-3 text-[11.5px] border rounded-md px-2 py-[3px] bg-white disabled:opacity-50"
        style={{ borderColor: TONE.line, color: TONE.label }}>
        {busy === t.id ? '…' : isArchived ? 'Restore' : 'Archive'}
      </button>
      <button onClick={() => !isArchived && setChosen(t.id)} disabled={isArchived}
              className="text-left w-full block">
        <span className="inline-block text-[10px] font-bold tracking-[.05em] uppercase rounded-full px-2 py-[2px] border mb-2"
              style={isArchived
                ? { borderColor: TONE.line, color: TONE.faint, background: '#fff' }
                : { borderColor: TONE.accentLine, color: TONE.accent, background: '#fff' }}>
          {isArchived ? 'Archived' : 'Ready'}
        </span>
        <div className="text-[14.5px] font-[620] mb-1 pr-[72px]" style={{ color: TONE.ink }}>{t.name}</div>
        <div className="text-[12.5px] leading-[1.55] mb-1.5" style={{ color: TONE.body }}>{t.blurb}</div>
        <div className="text-[11.5px]" style={{ color: TONE.label }}>
          {isArchived
            ? 'Out of the way. Nothing is lost.'
            : <>Needs <b style={{ color: TONE.ink }}>{t.needs}</b> {t.needsTail}</>}
        </div>
      </button>
    </div>
  )

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
        {live.map(t => card(t, false))}
      </div>
      {/* The heading only appears once something is in there, so the page stays
          clean until the first template is archived. */}
      {away.length > 0 && (
        <>
          <div className="text-[11px] font-bold tracking-[.08em] uppercase mt-6 mb-2.5"
               style={{ color: TONE.label }}>Archived</div>
          <div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
            {away.map(t => card(t, true))}
          </div>
        </>
      )}
    </div>
  )
}
