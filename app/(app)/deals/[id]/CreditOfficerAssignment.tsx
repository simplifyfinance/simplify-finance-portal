'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { can } from '@/lib/permissions'

export default function CreditOfficerAssignment({ dealId, brokerName, userRole }: { dealId: string; brokerName: string; userRole?: string }) {
  const supabase = createSupabaseBrowser()
  // Was hard-coded to admin, so opening up reassignDeals would have changed
  // nothing on screen - the API would have allowed it and the button would
  // still not have been there.
  const isAdmin = can(userRole, 'reassignDeals')
  const [assignedId, setAssignedId] = useState<string | null>(null)
  const [assignedName, setAssignedName] = useState<string>('')
  const [eligible, setEligible] = useState<{ id: string; name: string }[]>([])
  const [reassigning, setReassigning] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [picked, setPicked] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { load() }, [dealId])

  async function load() {

    const { data: deal } = await supabase.from('deals').select('assigned_credit_officer').eq('id', dealId).single()
    if (deal?.assigned_credit_officer) {
      setAssignedId(deal.assigned_credit_officer)
      const { data: officer } = await supabase.from('credit_officers').select('name').eq('id', deal.assigned_credit_officer).single()
      if (officer) setAssignedName(officer.name)
    }

    const brokerSlug = (brokerName || '').split(' ')[0].toLowerCase()
    const { data: links } = await supabase
      .from('credit_officer_brokers')
      .select('credit_officer_id, credit_officers!inner(id, name, active)')
      .ilike('broker_slug', brokerSlug)
      .eq('credit_officers.active', true)
    const options = (links || []).map((l: any) => l.credit_officers).filter(Boolean)
    setEligible(options)
  }

  async function handleReassign() {
    if (!picked) return
    setReassigning(true)
    setMsg('')
    setErr('')
    try {
      const res = await fetch('/api/reassign-credit-officer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, creditOfficerId: picked })
      })
      const data = await res.json()
      if (!data.ok) { setErr(data.error || 'Failed to reassign'); setReassigning(false); return }
      setAssignedId(picked)
      setAssignedName(data.assignedTo)
      setMsg('Reassigned')
      setShowPicker(false)
      setPicked('')
    } catch (e: any) {
      setErr(e.message)
    }
    setReassigning(false)
  }

  // NOBODY ASSIGNED AND NOBODY WHO COULD ASSIGN: there is nothing useful to
  // say, so the strip stays out of the way. Everyone else sees the state.
  if (!assignedId && !isAdmin) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-baseline gap-1.5 bg-page border border-line rounded-lg px-2.5 py-1">
        <span className="text-[9.5px] font-bold tracking-wider uppercase text-faint">Credit</span>
        {assignedId
          ? <span className="text-[13px] font-semibold text-ink">{assignedName}</span>
          // NOT A BLANK. An empty space reads as "loading" or as a layout
          // fault; this is a real state and it is the reason the credit team
          // cannot see the deal.
          : <span className="text-[13px] font-semibold text-chase">Nobody assigned</span>}
      </span>
      {!assignedId && (
        <span className="text-[11.5px] text-muted">
          The credit team cannot see this deal until somebody is on it.
        </span>
      )}
      {msg && <span className="text-xs text-done bg-done-bg border border-done-edge rounded-lg px-3 py-1.5">{msg}</span>}
      {err && <span className="text-xs text-chase bg-chase-bg border border-chase-edge rounded-lg px-3 py-1.5">{err}</span>}
      {isAdmin && !showPicker && assignedId && (
        <button onClick={() => setShowPicker(true)} className="text-xs text-brand-ink hover:underline">Reassign</button>
      )}
      {isAdmin && !showPicker && !assignedId && (
        <button onClick={() => setShowPicker(true)}
          className="text-xs bg-brand text-on-brand font-semibold rounded-lg px-3 py-1.5 hover:opacity-90">
          Assign a credit officer
        </button>
      )}
      {/* NOBODY TO PICK IS ITS OWN ANSWER.
          The list is the officers linked to THIS deal's broker, in
          credit_officer_brokers. An empty dropdown beside a Confirm button
          that can never be pressed is a dead end; saying why is not. */}
      {isAdmin && showPicker && eligible.filter(o => o.id !== assignedId).length === 0 && (
        <span className="text-[11.5px] text-chase">
          No credit officer is linked to {brokerName || 'this broker'}. Link one in Settings first.
        </span>
      )}
      {isAdmin && showPicker && eligible.filter(o => o.id !== assignedId).length > 0 && (
        <div className="flex items-center gap-2">
          <select className="border border-field-line bg-field rounded-lg px-2 py-1.5 text-xs" value={picked} onChange={e => setPicked(e.target.value)}>
            <option value="">— select officer —</option>
            {eligible.filter(o => o.id !== assignedId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={handleReassign} disabled={!picked || reassigning}
            className="text-xs bg-ink text-page px-3 py-1.5 rounded-lg disabled:opacity-40">
            {reassigning ? 'Saving...' : 'Confirm'}
          </button>
          <button onClick={() => { setShowPicker(false); setPicked('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}
      {isAdmin && showPicker && eligible.filter(o => o.id !== assignedId).length === 0 && (
        <button onClick={() => setShowPicker(false)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      )}
    </div>
  )
}
