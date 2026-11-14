'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { donePatch, wentThrough, wentThroughAt } from '@/lib/went-through-the-week'

// "THAT IS MY WEEK", AND SOMETHING HAPPENS.
//
// 14 Nov 2026. Until today the pill at the bottom of the broker's Monday
// screen was a <span>. It looked exactly like the solid dark buttons used
// everywhere else in the portal and it did nothing at all.
//
// Fabio: "Why would I leave a button fake?"
//
// THIS IS A RECORD, NOT A PREFERENCE. lib/use-theme-choice.ts deliberately
// fires its write and forgets it, because a colour that does not save costs
// nobody anything. This one is the opposite: the whole reason it exists is so
// the Monday meeting can tell a broker with nothing coming apart from a broker
// who never looked. A press that silently did not save would put a red mark
// next to somebody who did their job.
//
// So it goes through checkedWrite(), which is the only door - a policy that
// refuses a write returns NO ROWS AND NO ERROR, and every other sign on the
// screen would say it worked.
export function useWentThrough(now: Date = new Date()) {
  const [row, setRow] = useState<{ week_done_at?: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const id = useRef<string>('')

  useEffect(() => {
    let alive = true
    const supabase = createSupabaseBrowser()
    ;(async () => {
      const { data: me } = await supabase.auth.getUser()
      const uid = String(me?.user?.id || '')
      if (!uid || !alive) return
      id.current = uid
      const { data } = await supabase.from('user_profiles')
        .select('week_done_at').eq('id', uid).maybeSingle()
      if (alive) setRow((data as any) || {})
    })()
    return () => { alive = false }
  }, [])

  const told = wentThrough(row, now)
  const toldAt = wentThroughAt(row, now)

  /**
   * HE HAS BEEN THROUGH HIS WEEK.
   *
   * Pressing it again on the same day is not an error and not a second
   * record - it moves the time, which is the honest answer to "when did he
   * last look".
   */
  const say = useCallback(async () => {
    const uid = id.current
    if (!uid) { setProblem('Not signed in. Reload the page and try again.'); return }
    setBusy(true); setProblem('')
    const patch = donePatch(new Date())
    const error = await checkedWrite(
      createSupabaseBrowser().from('user_profiles').update(patch).eq('id', uid),
      'That is my week')
    setBusy(false)
    if (error) { setProblem(error); return }
    setRow(r => ({ ...(r || {}), ...patch }))
  }, [])

  return { told, toldAt, busy, problem, say, ready: row !== null }
}
