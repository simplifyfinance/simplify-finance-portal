'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { can } from '@/lib/permissions'
import { isAway, sayDate } from '@/lib/compliance-allocation'

// WHO HAS THE COMPLIANCE PACK, ON THE DEAL.
//
// 28 Oct 2026. Fabio: "on the deal card, on the top where it says who is the
// credit assessor working on the file, I want the ability of person number one
// or person number two, whoever it is that we send the compliance to show on
// the deal card with the ability to reassign."
//
// Beside the credit officer, in the same shape, because it answers the same
// kind of question: whose desk is this on.
//
// IT ONLY APPEARS ONCE A PACK HAS GONE OUT. Before that there is nothing to
// say - the allocation happens at the push, not before it - and a chip reading
// "Nobody" on every deal in the book would be noise on a question nobody is
// asking yet.

export default function CompliancePackAssignment({ dealId, userRole }: { dealId: string; userRole?: string }) {
  const supabase = createSupabaseBrowser()
  const canMove = can(userRole, 'reassignDeals')
  const [name, setName] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [at, setAt] = useState('')
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [picked, setPicked] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  /** The holder's leave, if the columns exist. Null means here, or not asked. */
  const [leave, setLeave] = useState<{ from: string | null; until: string | null }>({ from: null, until: null })

  useEffect(() => { load() }, [dealId])

  async function load() {
    try {
      const { data } = await supabase.from('deals')
        .select('compliance_pack_user_id, compliance_pack_user_name, compliance_pack_at')
        .eq('id', dealId).single()
      if (data?.compliance_pack_user_id) {
        setOwnerId(data.compliance_pack_user_id)
        setName(String(data.compliance_pack_user_name || ''))
        setAt(String(data.compliance_pack_at || ''))

        // IS THE PERSON HOLDING IT AWAY RIGHT NOW.
        //
        // The pack was allocated correctly on the day it went out. Leave booked
        // afterwards does not move it - a deal keeps whoever it was given to -
        // so the only honest thing to do is say so here, beside the Reassign
        // button that was already on this card.
        try {
          const { data: l } = await supabase.from('user_profiles')
            .select('on_leave_from, on_leave_until')
            .eq('id', data.compliance_pack_user_id).single()
          setLeave({ from: l?.on_leave_from || null, until: l?.on_leave_until || null })
        } catch {
          // docs/compliance-leave.sql has not been run. Nothing to say.
        }
      }
    } catch {
      // docs/compliance-allocation.sql has not been run. Nothing to show.
    }
  }

  async function openPicker() {
    setShowPicker(true)
    if (team.length === 0) {
      // Anybody on the team. Fabio asked for the full list rather than a swap
      // between the two in Settings - the person covering is not always the
      // other one.
      const { data } = await supabase.from('user_profiles')
        .select('id, full_name').eq('active', true).order('full_name')
      setTeam((data || []).filter((p: any) => p.full_name))
    }
  }

  async function move() {
    if (!picked) return
    setBusy(true); setMsg(''); setErr('')
    try {
      const res = await fetch('/api/reassign-compliance-pack', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, userId: picked }),
      })
      const data = await res.json()
      if (!data?.ok) { setErr(data?.error || 'It could not be moved'); setBusy(false); return }
      setOwnerId(picked)
      setName(data.assignedTo)
      // Said plainly when the email did not go, rather than implying it did.
      setMsg(data.emailSent ? 'Moved, and they have been emailed' : 'Moved — the email to them did not send')
      setShowPicker(false); setPicked('')
    } catch (e: any) {
      setErr(e?.message || 'It could not be moved')
    }
    setBusy(false)
  }

  if (!ownerId) return null

  const when = at
    ? new Date(at).toLocaleString('en-AU', {
        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
        timeZone: 'Australia/Sydney',
      })
    : ''

  // TODAY IN SYDNEY, not wherever the person looking at this happens to be.
  // The same day boundary the allocation itself counts on.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const theyAreAway = isAway(
    { id: ownerId, name, onLeaveFrom: leave.from, onLeaveUntil: leave.until }, today)

  return (
    <div className="flex flex-col gap-1.5 items-start">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-baseline gap-1.5 bg-page border border-line rounded-lg px-2.5 py-1">
        <span className="text-[9.5px] font-bold tracking-wider uppercase text-faint">Compliance pack</span>
        <span className="text-[13px] font-semibold text-ink">{name || 'Somebody'}</span>
        {when && <span className="text-[11px] text-faint">{when}</span>}
      </span>
      {msg && <span className="text-xs text-done bg-done-bg border border-done-edge rounded-lg px-3 py-1.5">{msg}</span>}
      {err && <span className="text-xs text-chase bg-chase-bg border border-chase-edge rounded-lg px-3 py-1.5">{err}</span>}
      {canMove && !showPicker && (
        <button onClick={openPicker} className="text-xs text-brand-ink hover:underline">Reassign</button>
      )}
      {canMove && showPicker && (
        <div className="flex items-center gap-2">
          <select className="border border-field-line bg-field rounded-lg px-2 py-1.5 text-xs"
            aria-label="Move the compliance pack to"
            value={picked} onChange={e => setPicked(e.target.value)}>
            <option value="">— who is taking it —</option>
            {team.filter(p => p.id !== ownerId).map(p => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
          <button onClick={move} disabled={!picked || busy}
            className="text-xs bg-ink text-page px-3 py-1.5 rounded-lg disabled:opacity-40">
            {busy ? 'Moving…' : 'Reassign and email them'}
          </button>
          <button onClick={() => { setShowPicker(false); setPicked('') }}
            className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}
    </div>
    {/* ONLY WHEN THE PERSON HOLDING IT IS AWAY. On every other deal this card
        is exactly what it was. */}
    {theyAreAway && (
      <div className="text-[12px] text-chase bg-chase-bg border border-chase-edge rounded-lg px-3 py-1.5">
        {name || 'They'} {leave.until ? `is away until ${sayDate(String(leave.until))}` : 'is away'}.
        {canMove ? <b> Reassign this one</b> : <b> Ask for it to be reassigned</b>} if it cannot wait.
      </div>
    )}
    </div>
  )
}
