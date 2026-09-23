// BUILDING AND HANDING OVER THE PERSONAL ASSESSMENT FORM.
//
// One place, because it is offered from three: the deal header, the settlement
// prompt and the close-deal panel. Three copies of the fetch would be three
// copies of the file name, and the file name is what somebody searches their
// folder for six months later.

import { expensesFor } from './household-expenses'

export function assessmentFileName(dealName: any): string {
  const clean = String(dealName || 'Assessment').replace(/[\/\\:*?"<>|]/g, '-').slice(0, 180)
  return `Simplify Finance - ${clean}.pdf`
}

export type Deal = {
  fact_find_data?: any
  compliance_data?: any
  deal_name?: string | null
  internal_notes?: string | null
}

// Returns nothing when it worked, and the sentence to show when it did not.
// A PDF that silently fails to arrive looks exactly like a click that did
// nothing, which is how somebody settles a deal believing the form is filed.
export async function downloadAssessment(deal: Deal): Promise<string | null> {
  try {
    const res = await fetch('/api/generate-assessment-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        factFind: deal?.fact_find_data || {},
        // Household 1 is every deal with one roof over it, which is almost all
        // of them. A second household's expenses are its own sheet.
        expenses: expensesFor(deal?.compliance_data, '1'),
        dealName: deal?.deal_name || '',
        notes: deal?.internal_notes || '',
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return body?.error || `The form could not be built (${res.status})`
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = assessmentFileName(deal?.deal_name)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return null
  } catch (e: any) {
    return e?.message || 'The form could not be built'
  }
}
