'use client'
import { useState } from 'react'
import { can } from '@/lib/permissions'
import { useBrokerNames } from '@/lib/broker-names'
import { sameBroker } from '@/lib/broker-key'

// WHERE THIS IS, AND WHY IT MOVED.
//
// 17 Sep 2026, Fabio: "need to be able to edit and reassign broker on the deal
// card." It was already possible - on the BC or LO tab, under Preview & share,
// at the bottom of the email preview. A control nobody can find is a control
// nobody has.
//
// Meanwhile the deal card header showed Broker and Credit officer side by side:
// the credit officer could be changed right there and the broker was a label.
// `chip` is that header form, deliberately identical to the one beside it, and
// it is now the only place this lives - the two buried copies are gone, because
// three copies of one control is three chances for two of them to disagree
// about who the broker is.
export default function BrokerAssignment({ dealId, currentBroker, userRole, chip }: { dealId: string; currentBroker: string; userRole?: string; chip?: boolean }) {
  // Everybody on the team, not just an admin - see reassignDeals in
  // lib/permissions.ts. manageAssignments is about the settings screens.
  const isAdmin = can(userRole, 'reassignDeals')
  const [assignedBroker, setAssignedBroker] = useState(currentBroker || '')
  const { options: brokerOptions, nameFor } = useBrokerNames()
  const [showPicker, setShowPicker] = useState(false)
  const [picked, setPicked] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

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
      {chip ? (
        <span className="inline-flex items-baseline gap-1.5 bg-[#FAF7F2] border border-[#E8E1D6] rounded-lg px-2.5 py-1">
          <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#A29889]">Broker</span>
          <span className="text-[13px] font-semibold text-[#2E2A26]">{assignedBroker ? nameFor(assignedBroker) : '—'}</span>
        </span>
      ) : (
        <span className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5">Broker: <span className="font-medium text-[#343333]">{assignedBroker ? nameFor(assignedBroker) : '—'}</span></span>
      )}
      {msg && <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">{msg}</span>}
      {err && <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{err}</span>}
      {isAdmin && !showPicker && (
        chip
          ? <button onClick={() => setShowPicker(true)} className="text-xs text-[#2DBEFF] hover:underline">Reassign</button>
          : <button onClick={() => setShowPicker(true)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Assign broker</button>
      )}
      {isAdmin && showPicker && (
        <div className="flex items-center gap-2">
          <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={picked} onChange={e => setPicked(e.target.value)}>
            <option value="">— select broker —</option>
            {brokerOptions.filter(b => !sameBroker(b.key, assignedBroker)).map(b => (
              <option key={b.key} value={b.key}>{b.name}</option>
            ))}
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
