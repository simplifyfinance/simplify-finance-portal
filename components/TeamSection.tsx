'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type UserProfile = {
  id: string
  email: string
  full_name: string
  role: string
  broker_key: string | null
  active: boolean
}

const roleOptions = ['admin', 'broker', 'staff']
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

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('user_profiles').update({ active: !active }).eq('id', id)
    setUsers(users.map(u => u.id === id ? { ...u, active: !active } : u))
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteName) return
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, fullName: inviteName, role: inviteRole })
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
          <div className="mb-3">
            <label className="text-xs text-gray-400 block mb-1">Role</label>
            <select className={selectCls} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {roleOptions.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
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
            <div key={user.id} className={`border border-gray-200 rounded-xl px-5 py-3 bg-white flex items-center justify-between gap-4 ${!user.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div style={{ background: '#343333' }} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#343333] truncate">{user.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                  {user.role}
                </span>
                <select className={selectCls} value={user.role} onChange={e => updateRole(user.id, e.target.value)}>
                  {roleOptions.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <button onClick={() => toggleActive(user.id, user.active)}
                  className={`text-xs px-3 py-1 rounded-lg border transition ${user.active ? 'border-red-200 text-red-400 hover:bg-red-50' : 'border-green-200 text-green-500 hover:bg-green-50'}`}>
                  {user.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
