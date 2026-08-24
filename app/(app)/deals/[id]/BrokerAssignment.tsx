'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { can } from '@/lib/permissions'

export default function BrokerAssignment({ dealId, currentBroker, userRole }: { dealId: string; currentBroker: string; userRole?: string }) {
  const supabase = createSupabaseBrowser()
  const isAdmin = can(userRole, 'manageAssignments')
  const [assignedBroker, setAssignedBroker] = useState(currentBroker || '')
  const [brokerOptions, setBrokerOptions] = useState<string[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [picked, setPicked] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { load() }, [])

  async function load() {

    const { data: brokerRows } = await supabase.from('brokers').select('broker_key, name, active').order('name')
    const names = (brokerRows || [])
      .filter((b: any) => b.active !== false)
      .map((b: any) => String(b.broker_key))
      .filter(Boolean)
    setBrokerOptions(names)
  }

  async function handleReassign() {
    if (!picked) return
    setSaving(true)
    setMsg('')
    setErr('')
    try {
      const res = await fetch('/api/reassign-broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, brokerName: picked })
      })
      const data = await res.json()
      if (!data.ok) { setErr(data.error || 'Failed to reassign'); setSaving(false); return }
      setAssignedBroker(picked)
      setMsg('Broker updated')
      setShowPicker(false)
      setPicked('')
    } catch (e: any) {
      setErr(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5">Broker: <span className="font-medium text-[#343333]">{assignedBroker || '—'}</span></span>
      {msg && <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">{msg}</span>}
      {err && <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{err}</span>}
      {isAdmin && !showPicker && (
        <button onClick={() => setShowPicker(true)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Assign broker</button>
      )}
      {isAdmin && showPicker && (
        <div className="flex items-center gap-2">
          <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={picked} onChange={e => setPicked(e.target.value)}>
            <option value="">— select broker —</option>
            {brokerOptions.filter(n => n !== assignedBroker).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={handleReassign} disabled={!picked || saving}
            className="text-xs bg-[#343333] text-white px-3 py-1.5 rounded-lg disabled:opacity-40">
            {saving ? 'Saving...' : 'Confirm'}
          </button>
          <button onClick={() => { setShowPicker(false); setPicked('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}
    </div>
  )
}
