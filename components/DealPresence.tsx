'use client'
import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { stillHere, presenceState, presenceMessage, sameTabNames, HEARTBEAT_MS, type Presence } from '@/lib/presence'
import { otherWindows, selfMessage, SELF_BEAT_MS, type SelfWindow } from '@/lib/self-presence'

// THE BANNER, AND THE HEARTBEAT BEHIND IT.
//
// Writes one row saying "I am here, on this tab" every twenty seconds, reads
// back everybody else's, and draws a line about it. Nothing else. See
// lib/presence.ts for why the tab is the interesting part, and
// docs/deal-presence-schema.sql for the table.
//
// It never blocks anything. If the table is missing, the query fails, or the
// user has no session, the banner simply does not appear - presence going quiet
// must never stop somebody working on a deal.
export default function DealPresence({ dealId, tab, onSameTab }: { dealId: string; tab: string; onSameTab?: (who: string) => void }) {
  const supabase = createSupabaseBrowser()
  const [others, setOthers] = useState<Presence[]>([])

  useEffect(() => {
    let alive = true
    let meId = ''

    async function beat() {
      const { data: session } = await supabase.auth.getUser()
      const user = session?.user
      if (!user?.id) return
      meId = user.id

      const profile = await supabase.from('user_profiles').select('full_name').eq('id', user.id).maybeSingle()
      const name = (user.user_metadata as any)?.full_name || profile.data?.full_name || user.email || ''

      // fire-and-forget: a heartbeat is advisory. If it does not land, the
      // banner does not draw and nothing else changes - and interrupting
      // somebody mid-deal to tell them a presence row failed would be worse
      // than the missing banner. Every other write in this codebase is checked;
      // this one has nothing to lose.
      await supabase.from('deal_presence')
        .upsert({ deal_id: dealId, user_id: user.id, full_name: name, tab, last_seen: new Date().toISOString() },
                { onConflict: 'deal_id,user_id' })
        .then(() => {})

      const { data } = await supabase.from('deal_presence')
        .select('user_id, full_name, tab, last_seen').eq('deal_id', dealId)

      if (!alive) return
      setOthers(stillHere((data || []).map((r: any) => ({
        userId: r.user_id, name: r.full_name || '', tab: r.tab || '', lastSeen: r.last_seen,
      })), meId))
    }

    beat()
    const timer = setInterval(beat, HEARTBEAT_MS)
    return () => {
      alive = false
      clearInterval(timer)
      // Drop off straight away rather than making everybody wait out the minute.
      // fire-and-forget: if this delete never lands the row simply goes stale on
      // its own after sixty seconds, which is the same outcome one minute later.
      if (meId) supabase.from('deal_presence').delete().eq('deal_id', dealId).eq('user_id', meId).then(() => {})
    }
  }, [dealId, tab])

  // AND YOU, IN ANOTHER WINDOW.
  //
  // deal_presence cannot see this - both rows would be you, and the banner
  // ignores you on purpose. Windows of the same browser can talk to each other
  // directly, so this needs no table and no extra database traffic. See
  // lib/self-presence.ts.
  const [mine, setMine] = useState<SelfWindow[]>([])
  const sessionRef = useRef<string>('')
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
    if (!sessionRef.current) sessionRef.current = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const me = sessionRef.current
    const channel = new BroadcastChannel(`deal-window-${dealId}`)
    let heard: SelfWindow[] = []

    channel.onmessage = (e: MessageEvent) => {
      const d = e.data as SelfWindow
      if (!d?.sessionId) return
      // Stamped on arrival, not on sending. Two machines' clocks disagree, and a
      // window whose clock is fast would otherwise look permanently fresh.
      heard = [...heard, { sessionId: d.sessionId, tab: String(d.tab || ''), at: Date.now() }].slice(-40)
      setMine(otherWindows(heard, me, Date.now()))
    }

    const beat = () => channel.postMessage({ sessionId: me, tab, at: Date.now() })
    beat()
    const timer = setInterval(() => {
      beat()
      // Re-checked on every beat, not only when something arrives, or a window
      // that has been closed would stay on screen forever.
      setMine(otherWindows(heard, me, Date.now()))
    }, SELF_BEAT_MS)

    return () => { clearInterval(timer); channel.close() }
  }, [dealId, tab])

  // Who else is on THIS tab, in words, for the save banner to name. The save
  // banner lives inside each form and has no presence of its own; without this
  // it can only say "somebody else", which on BC is no use to anybody.
  const sameTab = sameTabNames(others, tab)
  useEffect(() => { onSameTab?.(sameTab) }, [sameTab])

  const selfText = selfMessage(mine, tab)
  const msg = presenceMessage(presenceState(others, tab))
  if (!msg && !selfText) return null
  const loud = !!msg?.detail

  return (
    <>
    {selfText && (
      <div className="flex items-start gap-2.5 border border-[#EAE6DE] bg-[#F7F6F3] rounded-lg px-3 py-2 mb-3">
        <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#E8E1D6] text-[#6E665C] text-[11px] font-extrabold flex-shrink-0">2</span>
        <div className="text-[12.5px] leading-[1.58] text-[#6E665C]">{selfText}</div>
      </div>
    )}
    {msg && (
    <div className={loud
      ? 'flex items-start gap-2.5 border border-[#EBD9BE] bg-[#FDF6EC] rounded-[10px] px-3.5 py-2.5 mb-3'
      : 'flex items-center gap-2.5 border border-[#EAE6DE] bg-[#F7F6F3] rounded-lg px-3 py-2 mb-3'}>
      <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#2DBEFF] text-[#08252F] text-[9.5px] font-extrabold flex-shrink-0">
        {initials(others)}
      </span>
      <div className={loud ? 'text-[12.5px] leading-[1.58] text-[#8A6218]' : 'text-[12.5px] text-[#6E665C]'}>
        <b className={loud ? 'text-[#6E4E12]' : 'text-[#2E2A26]'}>{msg!.text}</b>
        {msg!.detail && <> {msg!.detail}</>}
      </div>
    </div>
    )}
    </>
  )
}

function initials(others: Presence[]): string {
  const n = (others[0]?.name || '').trim()
  if (!n) return '?'
  const parts = n.split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
