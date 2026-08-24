'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { ROLES } from '@/lib/permissions'

type UserProfile = {
  id: string
  email: string
  full_name: string
  role: string
  broker_key: string | null
  active: boolean
  is_admin?: boolean | null
  sees_finance?: boolean | null
  sees_all_deals?: boolean | null
}

// A broker key is the name deals are stamped with. It must match what is already
// on their deals, so it is suggested from the first name and then left alone.
function suggestKey(fullName: string): string {
  return (fullName || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
}

const roleOptions = [...ROLES]
const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  broker: 'bg-blue-100 text-blue-700',
  staff: 'bg-gray-100 text-gray-600',
}

export default function TeamSection() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('staff')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendMsg, setResendMsg] = useState<Record<string, string>>({})
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [accessId, setAccessId] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [accessMsg, setAccessMsg] = useState('')
  const [inviteKey, setInviteKey] = useState('')

  const supabase = createSupabaseBrowser()

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const { data } = await supabase.from('user_profiles').select('*').order('full_name')
    if (data) setUsers(data)
    setLoading(false)
  }

  async function updateRole(id: string, role: string) {
    await supabase.from('user_profiles').update({ role }).eq('id', id)
    setUsers(users.map(u => u.id === id ? { ...u, role } : u))
  }

  async function saveName(id: string) {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    await supabase.from('user_profiles').update({ full_name: trimmed }).eq('id', id)
    setUsers(users.map(u => u.id === id ? { ...u, full_name: trimmed } : u))
    setEditingNameId(null)
  }

  // Every write checks the rows that came back. A blocked write returns zero rows
  // and no error at all, which would otherwise look exactly like success.
  async function writeProfile(id: string, patch: Record<string, any>): Promise<boolean> {
    const { data, error } = await supabase.from('user_profiles').update(patch).eq('id', id).select('id')
    if (error) { setAccessMsg('NOT SAVED - ' + error.message); return false }
    if (!data || data.length === 0) { setAccessMsg('NOT SAVED - the database refused the change.'); return false }
    return true
  }

  async function saveBrokerKey(user: UserProfile) {
    const raw = keyInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    const value = raw === '' ? null : raw
    setAccessMsg('')
    if (value) {
      const clash = users.find(u => u.id !== user.id && (u.broker_key || '').toLowerCase() === value)
      if (clash) { setAccessMsg(`That key already belongs to ${clash.full_name}. Two people cannot share one.`); return }
    }
    if (!(await writeProfile(user.id, { broker_key: value }))) return
    setUsers(users.map(u => u.id === user.id ? { ...u, broker_key: value } : u))
    setAccessMsg(value
      ? `Saved. Deals stamped "${value}" now count towards them, and they appear on Targets and the Pipeline.`
      : 'Broker key cleared. They no longer appear as a broker anywhere.')
  }

  async function toggleFlag(user: UserProfile, field: 'is_admin' | 'sees_finance' | 'sees_all_deals') {
    setAccessMsg('')
    const next = !user[field]
    if (!(await writeProfile(user.id, { [field]: next }))) return
    setUsers(users.map(u => u.id === user.id ? { ...u, [field]: next } : u))
    setAccessMsg('Saved.')
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('user_profiles').update({ active: !active }).eq('id', id)
    setUsers(users.map(u => u.id === id ? { ...u, active: !active } : u))
  }

  async function handleDelete(user: UserProfile) {
    if (!confirm(`Permanently delete ${user.full_name}'s account? This cannot be undone.`)) return
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    })
    const data = await res.json()
    if (!data.ok) { alert('Error deleting: ' + data.error); return }
    setUsers(users.filter(u => u.id !== user.id))
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteName) return
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, fullName: inviteName, role: inviteRole,
                             brokerKey: inviteRole === 'broker' ? (inviteKey || suggestKey(inviteName)) : null })
    })
    const data = await res.json()
    if (data.ok) {
      setInviteMsg(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('staff')
      setShowInvite(false)
      fetchUsers()
    } else {
      setInviteMsg(data.error || 'Failed to send invitation')
    }
    setInviting(false)
  }

  async function handleResend(user: UserProfile) {
    setResendingId(user.id)
    setResendMsg(prev => ({ ...prev, [user.id]: '' }))
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, fullName: user.full_name, role: user.role })
    })
    const data = await res.json()
    setResendMsg(prev => ({
      ...prev,
      [user.id]: data.ok ? 'Invite resent' : (data.error || 'Failed')
    }))
    setResendingId(null)
    setTimeout(() => setResendMsg(prev => ({ ...prev, [user.id]: '' })), 4000)
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const selectCls = "border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2DBEFF]"

  return (
    <section className="mb-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Team</h2>
        <button onClick={() => setShowInvite(!showInvite)}
          className="text-sm text-[#2DBEFF] border border-dashed border-[#2DBEFF] rounded-lg px-4 py-1.5 hover:bg-blue-50 transition">
          + Invite member
        </button>
      </div>

      {showInvite && (
        <div className="border border-gray-200 rounded-xl p-5 mb-4 bg-blue-50/30">
          <p className="text-sm font-medium text-[#343333] mb-3">Invite a new team member</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Full name</label>
              <input className={inputCls} value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email</label>
              <input className={inputCls} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="jane@simplifyfinance.com.au" />
            </div>
          </div>
          <div className="mb-3 flex gap-4 items-end flex-wrap">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Role</label>
              <select className={selectCls} value={inviteRole}
                onChange={e => { setInviteRole(e.target.value); if (e.target.value === 'broker' && !inviteKey) setInviteKey(suggestKey(inviteName)) }}>
                {roleOptions.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            {inviteRole === 'broker' && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Broker key</label>
                <input className={selectCls + ' w-[140px]'} value={inviteKey}
                  onChange={e => setInviteKey(e.target.value)}
                  placeholder={suggestKey(inviteName) || 'jane'} />
                <p className="text-[11px] text-gray-400 mt-1 max-w-[280px]">
                  The name their deals are stamped with. Without it they never appear on Targets or the Pipeline.
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={handleInvite} disabled={inviting}
              className="bg-[#343333] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#2a2a2a] transition disabled:opacity-50">
              {inviting ? 'Sending...' : 'Send invitation'}
            </button>
            <button onClick={() => setShowInvite(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
          {inviteMsg && <p className="text-xs mt-2 text-[#2DBEFF]">{inviteMsg}</p>}
        </div>
      )}

      {loading ? <p className="text-sm text-gray-400">Loading team...</p> : (
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className={!user.active ? 'opacity-50' : ''}>
            <div className={`border border-gray-200 ${accessId === user.id ? 'rounded-t-xl' : 'rounded-xl'} px-5 py-3 bg-white flex items-center justify-between gap-4`}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div style={{ background: '#343333' }} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {editingNameId === user.id ? (
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap min-w-0">
                      <input className="text-sm font-medium border border-[#2DBEFF] rounded-lg px-2 py-1 w-[170px] min-w-0 focus:outline-none"
                        value={nameInput} onChange={e => setNameInput(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveName(user.id); if (e.key === 'Escape') setEditingNameId(null) }} />
                      <button onClick={() => saveName(user.id)}
                        className="text-xs font-medium text-white bg-[#2DBEFF] px-2.5 py-1 rounded-lg shrink-0 hover:bg-[#0E8FCB] transition">Save</button>
                      <button onClick={() => setEditingNameId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#343333] truncate">{user.full_name}</p>
                      <button onClick={() => { setEditingNameId(user.id); setNameInput(user.full_name) }}
                        className="text-xs text-[#2DBEFF] hover:underline flex-shrink-0">Edit</button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                  {user.role}
                </span>
                <select className={selectCls} value={user.role} onChange={e => updateRole(user.id, e.target.value)}>
                  {roleOptions.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <button
                  onClick={() => handleResend(user)}
                  disabled={resendingId === user.id}
                  className="text-xs px-3 py-1 rounded-lg border border-blue-200 text-[#2DBEFF] hover:bg-blue-50 transition disabled:opacity-50">
                  {resendingId === user.id ? 'Sending...' : resendMsg[user.id] || 'Resend invite'}
                </button>
                <button onClick={() => toggleActive(user.id, user.active)}
                  className={`text-xs px-3 py-1 rounded-lg border transition ${user.active ? 'border-red-200 text-red-400 hover:bg-red-50' : 'border-green-200 text-green-500 hover:bg-green-50'}`}>
                  {user.active ? 'Deactivate' : 'Activate'}
                </button>
                {!user.active && (
                  <button onClick={() => handleDelete(user)}
                    className="text-xs px-3 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-100 transition font-medium">
                    Delete
                  </button>
                )}
                <button onClick={() => {
                    const opening = accessId !== user.id
                    setAccessId(opening ? user.id : null)
                    setKeyInput(user.broker_key || '')
                    setAccessMsg('')
                  }}
                  className={`text-xs px-3 py-1 rounded-lg border transition ${accessId === user.id ? 'border-[#343333] bg-[#343333] text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  Access
                </button>
              </div>
            </div>

            {accessId === user.id && (
              <div className="border border-t-0 border-gray-200 rounded-b-xl px-5 py-4 bg-[#FDFCFA]">
                <div className="flex gap-6 flex-wrap">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Broker key</label>
                    <div className="flex gap-2 items-center">
                      <input className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm w-[150px] focus:outline-none focus:border-[#2DBEFF]"
                        value={keyInput} onChange={e => setKeyInput(e.target.value)}
                        placeholder={suggestKey(user.full_name) || 'not set'} />
                      <button onClick={() => saveBrokerKey(user)}
                        className="text-xs font-medium text-white bg-[#343333] px-3 py-1.5 rounded-lg hover:bg-[#2a2a2a]">Save</button>
                      {!user.broker_key && suggestKey(user.full_name) && keyInput !== suggestKey(user.full_name) && (
                        <button onClick={() => setKeyInput(suggestKey(user.full_name))}
                          className="text-xs text-[#2DBEFF] hover:underline">Use &ldquo;{suggestKey(user.full_name)}&rdquo;</button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5 max-w-[420px]">
                      What their deals are stamped with. It must match the deals they already have, so change it
                      only if those deals change with it. Empty means they are not a broker: no card on the
                      Pipeline, no column on Targets.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Permissions</label>
                    {([['is_admin', 'Admin', 'Sets targets and monthly actuals'],
                       ['sees_finance', 'Sees finance', 'Commissions and the finance screens'],
                       ['sees_all_deals', 'Sees all deals', 'Every deal, not just their own']] as const).map(([f, label, why]) => (
                      <label key={f} className="flex items-start gap-2 mb-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!user[f]} onChange={() => toggleFlag(user, f)} className="mt-[3px]" />
                        <span>
                          <span className="text-sm text-[#343333] block leading-tight">{label}</span>
                          <span className="text-[11px] text-gray-400">{why}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {(user.role === 'admin') !== !!user.is_admin && (
                  <div className="mt-3 bg-[#FDF6E7] border border-[#EFE0BC] rounded-lg px-3 py-2 text-[12px] text-[#7A5F17]">
                    <strong className="text-[#5E4A11]">Role and admin flag disagree.</strong>{' '}
                    Their role is {user.role}, but the admin flag is {user.is_admin ? 'on' : 'off'}. The role drives
                    what the deal screens allow; the flag drives Targets, Monthly actuals and the sidebar. Set both
                    the same unless you mean this.
                  </div>
                )}

                {accessMsg && (
                  <p className={`text-[12px] mt-3 ${accessMsg.startsWith('NOT SAVED') ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {accessMsg}
                  </p>
                )}
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
