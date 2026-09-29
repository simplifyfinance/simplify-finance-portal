'use client'
import { useEffect, useState } from 'react'
import LenderLibrary from '@/components/LenderLibrary'
import LenderRules from '@/components/LenderRules'

// Two panes under one nav item, driven by the URL hash the way Settings already
// is - so the sidebar can steer it and a link to one pane can be shared.
const PANES = [
  { key: 'lenders', label: 'Products & policy',
    blurb: 'Manage lenders and products. Import from a PDF or URL, or add manually.' },
  { key: 'rules', label: 'What we have learned',
    blurb: 'Answers the portal keeps per lender, asked once and used by every template after.' },
]

export default function LendersClient() {
  const [pane, setPane] = useState('lenders')
  useEffect(() => {
    const read = () => {
      const h = (window.location.hash || '#lenders').slice(1)
      setPane(PANES.some(x => x.key === h) ? h : 'lenders')
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const active = PANES.find(x => x.key === pane) || PANES[0]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#2E2A26] mb-1">Lender Library</h1>
      <p className="text-sm text-[#6E665C] mb-8">{active.blurb}</p>
      {pane === 'rules' ? <LenderRules /> : <LenderLibrary />}
    </div>
  )
}
