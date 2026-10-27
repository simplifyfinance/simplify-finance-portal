'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { SkelRows } from '@/components/Skeleton'
import { byBusiness, type Person, personFromRow, blankPerson } from '@/lib/the-directory'

// THE TEAM DIRECTORY, LIVE.
//
// 27 Oct 2026. Catherine, Operations Manager, item 9 of nine: "Live group
// directory - in the portal or Teams, instead of a PDF on the shared drive."
//
// The PDF covers SIMPLIFY GROUP: 35 people across seven businesses, Australia
// and the Philippines. Most of them have no portal login - the accountants,
// the buyers agents, the processing team - so this is not the Team page with
// a new coat on. user_profiles is who can sign in. This is who we are.
//
// ADD, EDIT AND DELETE, ALL THREE, FOR EVERYBODY. Fabio, 27 Oct: "please
// alwasy have ability to edit and delete and add". No admin gate, deliberately:
// a directory somebody has to ask an admin to correct is a directory that goes
// stale, which is the PDF again. The footer of the PDF asked people to report
// changes; this lets them make one.
//
// SEARCH BEFORE ANYTHING ELSE. Thirty people is three screens, and the reason
// anybody opens this is to find one number.

const INP = 'w-full text-[13px] border border-line rounded-lg px-2.5 py-1.5 text-ink bg-card focus:outline-none focus:border-brand'
const LOC = 'text-[10px] font-bold rounded-full px-2 py-[1px] border whitespace-nowrap'

export default function DirectoryList() {
  const supabase = createSupabaseBrowser()
  const [rows, setRows] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [find, setFind] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Person | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('directory_people')
      .select('*').order('business').order('sort_order').order('name')
    if (error) {
      setErr(/relation .* does not exist/i.test(error.message)
        ? 'The directory is not set up yet. Run docs/the-directory-is-live.sql in Supabase.'
        : error.message)
    } else {
      setRows((data || []).map(personFromRow))
    }
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const businesses = useMemo(
    () => [...new Set(rows.map(r => r.business).filter(Boolean))].sort(), [rows])
  const groups = useMemo(() => byBusiness(rows, find), [rows, find])
  const shown = groups.reduce((n, g) => n + g.people.length, 0)

  async function save(p: Person) {
    setBusy(true); setErr('')
    const patch = {
      business: p.business.trim() || 'Simplify Finance',
      name: p.name.trim(), role: p.role.trim() || null,
      email: p.email.trim() || null, phone: p.phone.trim() || null,
      location: p.location.trim() || null,
      updated_at: new Date().toISOString(),
    }
    // A blocked policy returns no rows and no error, so the row is the proof.
    const { data, error } = p.id
      ? await supabase.from('directory_people').update(patch).eq('id', p.id).select('id')
      : await supabase.from('directory_people').insert(patch).select('id')
    if (error || !data?.length) {
      setErr(error?.message || 'That was not saved — nothing reached the database.')
    } else {
      setEditing(null); setDraft(null); await load()
    }
    setBusy(false)
  }

  async function remove(id: string) {
    setBusy(true); setErr('')
    const { error } = await supabase.from('directory_people').delete().eq('id', id)
    if (error) setErr(error.message)
    else { setConfirming(null); await load() }
    setBusy(false)
  }

  if (loading) return <SkelRows rows={8} cols={5} />

  return (
    <div>
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <input className={`${INP} max-w-[320px]`} value={find} onChange={e => setFind(e.target.value)}
          placeholder="Find a name, a role, a business…" />
        <span className="text-[12px] text-faint">
          {find ? `${shown} of ${rows.length}` : `${rows.length} people · ${businesses.length} businesses`}
        </span>
        <span className="flex-1" />
        <button onClick={() => { setEditing('new'); setDraft(blankPerson(businesses[0] || 'Simplify Finance')) }}
          className="text-[12.5px] font-semibold text-[#0E8FCB] bg-card border border-[#BFE6F9] rounded-lg px-4 py-2 hover:bg-[#EAF7FE]">
          + Add somebody
        </button>
      </div>

      {err && <p className="text-[12px] text-chase mb-3">{err}</p>}

      {editing === 'new' && draft && (
        <Editor p={draft} businesses={businesses} busy={busy}
          onChange={setDraft} onCancel={() => { setEditing(null); setDraft(null) }}
          onSave={() => save(draft)} />
      )}

      {groups.length === 0 && !err && (
        <p className="text-[12.5px] text-faint">Nobody matches that.</p>
      )}

      {groups.map(g => (
        <div key={g.business} className="mb-7">
          <h2 className="text-[10px] font-semibold text-faint uppercase tracking-[0.09em] mb-3 flex items-center gap-2">
            <span className="w-[5px] h-[5px] rounded-full bg-info inline-block shrink-0" />
            {g.business}
            <span className="font-normal normal-case tracking-normal text-[11px]">{g.people.length}</span>
          </h2>

          <div className="border border-[#EDE7DD] rounded-xl bg-card overflow-hidden">
            {g.people.map(p => editing === p.id && draft ? (
              <div key={p.id} className="border-b border-line-soft last:border-b-0 p-3">
                <Editor p={draft} businesses={businesses} busy={busy}
                  onChange={setDraft} onCancel={() => { setEditing(null); setDraft(null) }}
                  onSave={() => save(draft)} />
              </div>
            ) : (
              <div key={p.id}
                className="flex gap-3 items-center px-4 py-2.5 border-b border-line-soft last:border-b-0 text-[13px] flex-wrap">
                <span className="font-semibold min-w-[150px]">{p.name}</span>
                <span className="text-muted min-w-[180px] flex-1">{p.role}</span>
                {p.email
                  ? <a href={`mailto:${p.email}`} className="text-brand-ink hover:underline min-w-[230px]">{p.email}</a>
                  : <span className="text-faint min-w-[230px]">—</span>}
                {p.phone
                  ? <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="text-body hover:underline min-w-[120px] tabular-nums">{p.phone}</a>
                  : <span className="text-faint min-w-[120px]">—</span>}
                <span className={`${LOC} ${p.location === 'PH'
                  ? 'bg-waiting-bg text-waiting border-waiting-edge'
                  : 'bg-info-bg text-info border-info-edge'}`}>{p.location || '—'}</span>

                {confirming === p.id ? (
                  <span className="flex gap-1.5 items-center">
                    <span className="text-[11.5px] text-chase">Remove {p.name}?</span>
                    <button onClick={() => remove(p.id)} disabled={busy}
                      className="text-[11.5px] font-bold text-white bg-chase rounded-lg px-2.5 py-1">
                      {busy ? '…' : 'Remove'}
                    </button>
                    <button onClick={() => setConfirming(null)}
                      className="text-[11.5px] border border-card-line rounded-lg px-2.5 py-1 text-body">Keep</button>
                  </span>
                ) : (
                  <span className="flex gap-1.5">
                    <button onClick={() => { setEditing(p.id); setDraft({ ...p }) }}
                      className="text-[11.5px] text-brand-ink border border-card-line rounded-lg px-2.5 py-1 hover:bg-page">Edit</button>
                    <button onClick={() => setConfirming(p.id)}
                      className="text-[11.5px] text-faint border border-card-line rounded-lg px-2.5 py-1 hover:text-chase">Remove</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Editor({ p, businesses, busy, onChange, onSave, onCancel }: {
  p: Person; businesses: string[]; busy: boolean
  onChange: (p: Person) => void; onSave: () => void; onCancel: () => void
}) {
  const set = (k: keyof Person) => (v: string) => onChange({ ...p, [k]: v })
  return (
    <div className="border-[1.5px] border-ink rounded-xl p-4 bg-card mb-4">
      <div className="flex gap-2 flex-wrap mb-2">
        <input className={`${INP} flex-1 min-w-[160px] font-semibold`} value={p.name}
          onChange={e => set('name')(e.target.value)} placeholder="Name" autoFocus />
        <input className={`${INP} flex-1 min-w-[160px]`} value={p.role}
          onChange={e => set('role')(e.target.value)} placeholder="Role" />
      </div>
      <div className="flex gap-2 flex-wrap mb-2">
        <input className={`${INP} flex-1 min-w-[200px]`} value={p.email}
          onChange={e => set('email')(e.target.value)} placeholder="Email" />
        <input className={`${INP} flex-1 min-w-[140px]`} value={p.phone}
          onChange={e => set('phone')(e.target.value)} placeholder="Phone" />
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {/* A NEW BUSINESS IS TYPED, NOT MIGRATED. Seven today; an eighth is a
            row rather than a schema change. */}
        <input className={`${INP} flex-1 min-w-[180px]`} value={p.business} list="sg-businesses"
          onChange={e => set('business')(e.target.value)} placeholder="Business" />
        <datalist id="sg-businesses">{businesses.map(b => <option key={b} value={b} />)}</datalist>
        <select className={`${INP} max-w-[110px]`} value={p.location}
          onChange={e => set('location')(e.target.value)}>
          <option value="">Where</option><option value="AU">AU</option><option value="PH">PH</option>
        </select>
        <span className="flex-1" />
        <button onClick={onCancel} disabled={busy}
          className="text-[12px] border border-card-line bg-card rounded-lg px-3 py-1.5 text-body hover:bg-page">Cancel</button>
        <button onClick={onSave} disabled={busy || !p.name.trim()}
          className="text-[12px] bg-ink text-page rounded-lg px-4 py-1.5 font-bold disabled:opacity-40">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
