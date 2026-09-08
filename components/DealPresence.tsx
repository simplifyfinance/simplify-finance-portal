'use client'
import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { stillHere, initials, chipTitle, sameTabNames,
         HEARTBEAT_MS, IDLE_AFTER_MS, type Presence } from '@/lib/presence'

// WHO ELSE IS HERE, AS A ROW OF CIRCLES.
//
// This used to be up to three banners stacked above the form, each appearing
// and disappearing on its own timer - three seconds, twenty seconds, fifteen
// seconds. Every time one came or went, every field below it moved. Fabio,
// 8 Sep 2026, after testing with Kylie: "the fields were moving. It's just not
// working."
//
// That was my mistake and it is the whole reason the page jumped. Notices about
// people do not belong in the middle of somebody's form. This is a fixed-height
// row of initials in the deal header: it is always there, whether anybody else
// is or not, so nothing below it can ever move.
//
// It never blocks anything. If the query fails or the user has no session, the
// row is simply empty - presence going quiet must never stop somebody working.
export default function DealPresence({ dealId, tab, onSameTab }:
  { dealId: string; tab: string; onSameTab?: (who: string) => void }) {
  const supabase = createSupabaseBrowser()
  const [others, setOthers] = useState<Presence[]>([])

  // A TAB LEFT OPEN IS NOT A PERSON.
  //
  // The heartbeat used to fire for as long as the page existed, so somebody who
  // opened a deal and switched to Outlook stayed in it until they logged out.
  // Any real input counts as being here; nothing else does.
  const lastActive = useRef(Date.now())
  useEffect(() => {
    const seen = () => { lastActive.current = Date.now() }
    const events: (keyof WindowEventMap)[] = ['keydown', 'pointerdown', 'wheel', 'focus']
    events.forEach(e => window.addEventListener(e, seen, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, seen))
  }, [])

  useEffect(() => {
    let alive = true
    let meId = ''

    async function beat() {
      const { data: session } = await supabase.auth.getUser()
      const user = session?.user
      if (!user?.id) return
      meId = user.id

      const here = document.visibilityState === 'visible'
                && Date.now() - lastActive.current < IDLE_AFTER_MS

      if (here) {
        const profile = await supabase.from('user_profiles').select('full_name').eq('id', user.id).maybeSingle()
        const name = (user.user_metadata as any)?.full_name || profile.data?.full_name || user.email || ''
        // fire-and-forget: a heartbeat is advisory. If it does not land the row
        // simply expires and a circle is missing - which is a far smaller
        // problem than interrupting somebody mid-deal to say so.
        await supabase.rpc('presence_beat', { p_deal: dealId, p_tab: tab, p_name: name }).then(() => {})
      }

      // Read regardless: somebody who has stepped away should still see who
      // arrived while they were gone.
      const { data } = await supabase.rpc('presence_others', { p_deal: dealId })
      if (!alive) return
      setOthers(stillHere((data || []).map((r: any) => ({
        userId: r.user_id, name: r.full_name || '', tab: r.tab || '', secondsAgo: Number(r.seconds_ago),
      })), meId))
    }

    beat()
    const timer = setInterval(beat, HEARTBEAT_MS)
    // Coming back to the tab should show the truth immediately, not in fifteen
    // seconds' time.
    const onShow = () => { if (document.visibilityState === 'visible') { lastActive.current = Date.now(); beat() } }
    document.addEventListener('visibilitychange', onShow)

    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
      // Instant in the ordinary case. NOT relied on - a closed laptop never
      // calls it, which is why the sixty second expiry in the database is the
      // real mechanism. See docs/deal-presence-v2.sql.
      // fire-and-forget: if it never lands the row expires by itself.
      if (meId) supabase.rpc('presence_leave').then(() => {})
    }
  }, [dealId, tab])

  // The forms ask so they know they are not alone. Nothing is shown to anybody
  // because of it.
  useEffect(() => { onSameTab?.(sameTabNames(others, tab)) }, [others, tab])

  // Fixed height, always rendered. This is the part that stops the page moving.
  return (
    <div className="flex items-center gap-1.5 h-[26px]">
      {others.map(o => {
        const sameTab = String(o.tab || '').trim() === String(tab || '').trim()
        return (
          <span key={o.userId} title={chipTitle(o)}
            className={`inline-flex items-center justify-center w-[26px] h-[26px] rounded-full
              text-[10px] font-extrabold select-none cursor-default
              ${sameTab ? 'bg-[#2DBEFF] text-[#08252F] ring-2 ring-[#2DBEFF]/25'
                        : 'bg-[#E8E1D6] text-[#6E665C]'}`}>
            {initials(o.name)}
          </span>
        )
      })}
    </div>
  )
}
