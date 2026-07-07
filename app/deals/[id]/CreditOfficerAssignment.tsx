'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export default function CreditOfficerAssignment({ dealId, brokerName }: { dealId: string; brokerName: string }) {
  const supabase = createSupabaseBrowser()
  const [isAdmin, setIsAdmin] = useState(false)
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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
      setIsAdmin(profile?.role === 'admin')
    }

    const { data: deal } = await supabase.from('deals').select('assigned_credit_officer').eq('id', dealId).single()
    if (deal?.assigned_credit_officer) {
      setAssignedId(deal.assigned_credit_officer)
      const { data: officer } = await supabase.from('credit_officers').select('name').eq('id', deal.assigned_credit_officer).single()
      if (officer) setAssignedName(officer.name)
    }

    const brokerSlug = (brokerName || '').split(' ')[0]
    const { data: links } = await supabase
      .from('credit_officer_brokers')
      .select('credit_officer_id, credit_officers!inner(id, name, active)')
      .eq('broker_slug', brokerSlug)
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

  if (!assignedId) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5">Assigned to: <span className="font-medium text-[#343333]">{assignedName}</span></span>
      {msg && <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">{msg}</span>}
      {err && <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{err}</span>}
      {isAdmin && !showPicker && (
        <button onClick={() => setShowPicker(true)} className="text-xs text-[#2DBEFF] hover:underline">Reassign</button>
      )}
      {isAdmin && showPicker && (
        <div className="flex items-center gap-2">
          <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={picked} onChange={e => setPicked(e.target.value)}>
            <option value="">— select officer —</option>
            {eligible.filter(o => o.id !== assignedId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={handleReassign} disabled={!picked || reassigning}
            className="text-xs bg-[#343333] text-white px-3 py-1.5 rounded-lg disabled:opacity-40">
            {reassigning ? 'Saving...' : 'Confirm'}
          </button>
          <button onClick={() => { setShowPicker(false); setPicked('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}
    </div>
  )
}
