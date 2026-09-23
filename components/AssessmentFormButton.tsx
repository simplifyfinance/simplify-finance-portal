"use client"
import { useState } from 'react'
import { expensesFor } from '@/lib/household-expenses'

// THE PERSONAL ASSESSMENT FORM, FROM THE DEAL HEADER.
//
// 23 Sep 2026. The team saves a copy of this into the client's folder when a
// deal settles. It is the same piece of paper they have always used, filled in
// from the deal, and every box is still typeable - so a figure that changed
// after settlement can be corrected without coming back here.
//
// It downloads. It is not written into OneDrive: the portal has no connection
// to it, and Fabio files these himself.
export default function AssessmentFormButton({ deal }: { deal: any }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function make() {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/generate-assessment-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factFind: deal?.fact_find_data || {},
          // Household 1 is every deal with one roof over it, which is almost
          // all of them. A second household's expenses are its own sheet.
          expenses: expensesFor(deal?.compliance_data, '1'),
          dealName: deal?.deal_name || '',
          notes: deal?.internal_notes || '',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `The form could not be built (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Simplify Finance - ${String(deal?.deal_name || 'Assessment').replace(/[\/\\:*?"<>|]/g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Given back straight away rather than left for the browser to collect.
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e: any) {
      // Said out loud on the button rather than in a console nobody opens.
      setErr(e?.message || 'The form could not be built')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button onClick={make} disabled={busy}
        title="The Personal Assessment Form, filled in and still typeable"
        className="text-xs text-[#6E665C] bg-[#FAF7F2] px-3.5 py-2 hover:bg-[#F4EEE4] transition inline-flex items-center gap-2 border-r border-[#E8E1D6] disabled:opacity-40">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="2" width="11" height="12" rx="1.3"/><path d="M5 5.5h6M5 8h6M5 10.5h3.5"/>
        </svg>
        {busy ? 'Building...' : 'Assessment'}
      </button>
      {err && <span className="text-[11px] text-red-600 ml-2 self-center">{err}</span>}
    </>
  )
}
