'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { readNotice, nagLine, isOverdue, NO_NOTICE, type RateNotice, type LenderLike } from '@/lib/rate-notice'

// THE THING THAT STOPS IT BEING FORGOTTEN.
//
// The risk with a disclaimer is never switching it on. It is one still going out
// in February saying "the recent increase of 0.25%" after two more decisions -
// which is worse than no disclaimer, because it is wrong rather than missing.
//
// So past its review date the dashboard says so, every day, and NAMES WHAT THE
// EMAILS ARE CURRENTLY CLAIMING. "Review the rate notice" is a chore. "This is
// still telling clients ANZ has not passed on the 30 September increase" is a
// decision somebody can make on the spot.
//
// IT NEVER SWITCHES ITSELF OFF. A disclaimer that vanishes on a timer is its own
// problem - somebody has to decide it is no longer true. This just makes it
// impossible to ignore. Fabio, 30 Sep 2026: "like the reminder".
export default function RateNoticeNag() {
  const [notice, setNotice] = useState<RateNotice>(NO_NOTICE)
  const [lenders, setLenders] = useState<LenderLike[]>([])

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    let alive = true
    Promise.all([
      supabase.from('settings').select('rate_notice').eq('id', 'singleton').maybeSingle(),
      supabase.from('lenders').select('id, name, rate_notice_for').order('name'),
    ]).then(([{ data: s }, { data: l }]: any) => {
      if (!alive) return
      setNotice(readNotice(s?.rate_notice))
      setLenders((l || []) as LenderLike[])
    }).catch(() => { /* a column that is not there yet draws nothing */ })
    return () => { alive = false }
  }, [])

  if (!isOverdue(notice)) return null
  const line = nagLine(notice, lenders)
  if (!line) return null

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#E9D2CF] bg-[#FDF3F2] px-4 py-3">
      <span className="text-[15px] leading-[1.2] text-[#8E3A34]">&#9888;</span>
      <p className="m-0 text-[12.5px] text-[#8E3A34] leading-relaxed">{line}</p>
      <Link href="/settings#rate-notice"
        className="ml-auto shrink-0 rounded-lg border border-[#E9D2CF] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#8E3A34] hover:bg-[#FFF7F6]">
        Open it
      </Link>
    </div>
  )
}
