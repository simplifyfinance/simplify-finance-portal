'use client'
import { useEffect, useState } from 'react'
import { PAGE_WIDE } from '@/lib/page-width'
import LenderLibrary from '@/components/LenderLibrary'
import LenderRules from '@/components/LenderRules'
import RateNoticeSettings from '@/components/RateNoticeSettings'
import { LENDER_PANES, isLenderPane, DEFAULT_LENDER_PANE } from '@/lib/lender-panes'

// Panes under one nav item, driven by the URL hash the way Settings already is -
// so the sidebar can steer it and a link to one pane can be shared. The list
// itself is in lib/lender-panes.ts, read by the sidebar too.
const PANES = LENDER_PANES

export default function LendersClient() {
  const [pane, setPane] = useState('lenders')
  useEffect(() => {
    const read = () => {
      const h = (window.location.hash || '#lenders').slice(1)
      setPane(isLenderPane(h) ? h : DEFAULT_LENDER_PANE)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const active = PANES.find(x => x.key === pane) || PANES[0]

  return (
    <div className={PAGE_WIDE}>
      <h1 className="text-2xl font-bold text-ink mb-1">Lender Library</h1>
      <p className="text-sm text-muted mb-8">{active.blurb}</p>
      {pane === 'rate-notice' ? <RateNoticeSettings />
        : pane === 'rules' ? <LenderRules />
        : <LenderLibrary />}
    </div>
  )
}
