'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import {
  readNotice, defaultReviewBy, stillCarrying, notAnnounced, allPassedOn, isOverdue,
  nagLine, loadTheseRatesLine, announcedFrom, hasTakenEffect, forNextDecision,
  nextDecisionWarning, niceDate, NO_NOTICE, REVIEW_DAYS, type RateNotice, type LenderLike,
} from '@/lib/rate-notice'

// WHERE THE RBA NOTICE IS WRITTEN, AND THE ONLY PLACE THE WORDS EXIST.
//
// Fabio, 30 Sep 2026. Every client email that quotes a rate reads from here, so
// it cannot end up on three of them and missing from the fourth - which is what
// happens when four people paste a paragraph into four files.
//
// STARTING THE NEXT ONE IS ONE EDIT. Change the decision date and every lender's
// tick stops matching by itself, because a tick names the decision it was made
// for rather than saying yes. There is no "clear the ticks" button, because a
// button like that is one somebody forgets to press - and forgetting it leaves
// seven banks silently exempt from a warning nobody has passed on.

const SUGGESTED =
  'Please note, the rates quoted above do not factor in the recent RBA rate change. ' +
  'Lenders will announce in the coming days when this will be passed on to their customers.'

export default function RateNoticeSettings() {
  const supabase = createSupabaseBrowser()
  const [notice, setNotice] = useState<RateNotice>(NO_NOTICE)
  const [lenders, setLenders] = useState<LenderLike[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState('')
  const [nextDate, setNextDate] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('settings').select('rate_notice').eq('id', 'singleton').maybeSingle(),
      supabase.from('lenders').select('id, name, rate_notice_for, rate_notice_from, rate_notice_by').order('name'),
    ]).then(([{ data: s }, { data: l }]: any) => {
      if (!alive) return
      setNotice(readNotice(s?.rate_notice))
      setLenders((l || []) as LenderLike[])
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  async function save(next: RateNotice) {
    setErr(''); setSaved('')
    const problem = await checkedWrite(
      supabase.from('settings').update({ rate_notice: next }).eq('id', 'singleton'),
      'The rate notice')
    if (problem) { setErr(problem); return }
    setNotice(next)
    setSaved('Saved.')
  }

  if (loading) return <p className="text-[13px] text-[#A29889]">Loading&hellip;</p>

  const waiting = stillCarrying(lenders, notice)
  const silent = notAnnounced(lenders, notice)
  const loadSoon = loadTheseRatesLine(lenders, notice)
  const done = allPassedOn(lenders, notice)
  const overdue = isOverdue(notice)
  const set = (patch: Partial<RateNotice>) => setNotice(n => ({ ...n, ...patch }))

  return (
    <div className="max-w-[640px]">
      <p className="text-[12.5px] text-[#6E665C] mb-4">
        Goes on every client email that quotes a rate &mdash; the borrowing capacity, the lending
        options, the pre-approval and the formal approval. <b>Nothing signed</b>, so it never outlives
        the few weeks it is about.
      </p>

      {overdue && (
        <p className="mb-4 rounded-lg border border-[#E9D2CF] bg-[#FDF3F2] px-3 py-2.5 text-[12.5px] text-[#8E3A34] leading-relaxed">
          {nagLine(notice, lenders)}
        </p>
      )}

      {loadSoon && (
        <p className="mb-4 rounded-lg border border-[#EBD9BE] bg-[#FDF6EC] px-3 py-2.5 text-[12.5px] text-[#8A6218] leading-relaxed">
          {loadSoon}
        </p>
      )}

      {notice.on && done && (
        <p className="mb-4 rounded-lg border border-[#BBE7CF] bg-[#F4FBF7] px-3 py-2.5 text-[12.5px] text-[#0F7B4F]">
          Every lender has passed this one on, so it is doing nothing. Turn it off.
        </p>
      )}

      <label className="block text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889] mb-1.5">
        Turn it on
      </label>
      <button type="button" onClick={() => save({ ...notice, on: !notice.on })}
        className={`inline-flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${
          notice.on ? 'border-[#BBE7CF] bg-[#F4FBF7] text-[#0F7B4F]'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
        <span className={`w-[34px] h-[19px] rounded-full relative shrink-0 ${notice.on ? 'bg-[#0F7B4F]' : 'bg-gray-300'}`}>
          <span className={`absolute top-[2px] w-[15px] h-[15px] rounded-full bg-white ${notice.on ? 'right-[2px]' : 'left-[2px]'}`} />
        </span>
        {notice.on
          ? (waiting.length
              ? `On — ${waiting.length} lender${waiting.length === 1 ? '' : 's'} still carrying it` +
                (silent.length ? `, ${silent.length} with no date yet` : '')
              : 'On')
          : 'Off — no notice on any email'}
      </button>
      {!notice.on && (!notice.text.trim() || !notice.decisionDate) && (
        <p className="mt-1.5 text-[11px] text-[#8A6218]">
          It needs words and a decision date before it can go on. Without a date there is no way to
          tick a lender off it.
        </p>
      )}

      <label className="block text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889] mb-1.5 mt-5">
        What it says
      </label>
      <textarea value={notice.text} onChange={e => set({ text: e.target.value })}
        onBlur={() => save(notice)} rows={3}
        placeholder={SUGGESTED}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed focus:outline-none focus:border-[#2DBEFF]" />
      <p className="mt-1 text-[11px] text-gray-400">
        Your words. It is text rather than something built in, so the next one can be a cut, a hold
        or a different figure without anybody touching the code.
      </p>

      <div className="flex gap-4 flex-wrap mt-5">
        <div>
          <label className="block text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889] mb-1.5">
            Decision date
          </label>
          <input type="date" value={notice.decisionDate}
            onChange={e => {
              const d = e.target.value
              // The review date follows the decision unless somebody has moved
              // it themselves. Three weeks - Fabio, 30 Sep 2026: "3 weeks is
              // perfect, like the reminder".
              const keep = notice.reviewBy && notice.reviewBy !== defaultReviewBy(notice.decisionDate)
              set({ decisionDate: d, reviewBy: keep ? notice.reviewBy : defaultReviewBy(d) })
            }}
            onBlur={() => save(notice)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px]" />
          <p className="mt-1 text-[11px] text-gray-400 max-w-[260px]">
            What &ldquo;recent&rdquo; means. <b>Changing it puts every lender back on the notice</b>,
            which is how the next decision gets started.
          </p>
        </div>
        <div>
          <label className="block text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889] mb-1.5">
            Review by
          </label>
          <input type="date" value={notice.reviewBy}
            onChange={e => set({ reviewBy: e.target.value })} onBlur={() => save(notice)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px]" />
          <p className="mt-1 text-[11px] text-gray-400 max-w-[260px]">
            {REVIEW_DAYS} days by default. After this the dashboard asks you about it every day.
            It never switches itself off &mdash; a disclaimer that vanishes quietly is its own problem.
          </p>
        </div>
      </div>

      {notice.on && (
        <>
          <label className="block text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889] mb-2 mt-6">
            Where it stands
          </label>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {lenders.filter(l => String(l.name || '').trim()).map(l => {
              const from = announcedFrom(l, notice)
              const live = hasTakenEffect(l, notice)
              return (
                <div key={l.id || l.name}
                  className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-b-0 text-[12.5px]">
                  <span className="font-semibold text-[#221F1B] w-[150px] truncate">{l.name}</span>
                  <span className={`text-[11.5px] font-semibold ${
                    live ? 'text-[#0F7B4F]' : from ? 'text-[#0E8FCB]' : 'text-[#8A6218]'}`}>
                    {live ? `In force since ${niceDate(from)} — no notice`
                      : from ? `Notice until ${niceDate(from)}, then it stops by itself`
                      : 'No date yet — notice runs with no end'}
                  </span>
                  {l.rate_notice_by && (
                    <span className="text-[11px] text-[#C3BDB2] ml-auto">{l.rate_notice_by}</span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Each bank&rsquo;s date goes in on the <b>Lenders</b> page when they announce it &mdash;
            anybody can, and their name goes on it. The notice comes off that bank&rsquo;s emails on
            the day, with nobody having to be at their desk for it.
          </p>
        </>
      )}

      {/* DOING IT AGAIN, TWO MONTHS FROM NOW. Fabio, 30 Sep 2026: "think abaout
          how we do that agin in 2 months tiems".
          One field. Every date a bank gave you is stamped with the decision it
          answered, so a new decision date makes all of them stop applying at
          once - there is no clear-down to run and nothing to half-finish. */}
      <label className="block text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889] mb-1.5 mt-7">
        Next RBA decision
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px]" />
        <button type="button" disabled={!nextDate}
          onClick={() => { save(forNextDecision(notice, nextDate)); setNextDate('') }}
          className="rounded-lg bg-[#221F1B] px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40">
          Start it
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400 max-w-[420px]">
        {nextDate
          ? nextDecisionWarning(lenders, notice)
          : 'Sets the new decision date and a review three weeks on. Every date the banks gave you ' +
            'for the last one stops applying by itself \u2014 there is nothing to clear.'}
      </p>

      {err && <p className="mt-3 rounded-lg border border-[#E9D2CF] bg-[#FDF3F2] px-3 py-2 text-[12.5px] text-[#8E3A34]">{err}</p>}
      {saved && !err && <p className="mt-3 text-[12px] text-[#15803D]">{saved}{notice.decisionDate ? ` The notice is about the ${niceDate(notice.decisionDate)} decision.` : ''}</p>}
    </div>
  )
}
