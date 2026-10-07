'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import {
  readNotice, defaultReviewBy, stillCarrying, notAnnounced, allPassedOn, isOverdue,
  nagLine, announcedFrom, hasTakenEffect, forNextDecision,
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

// ONE DEFINITION, RENDERED IN TWO PLACES. Beside the toggle and under the
// lender list, because both ends of this panel can cause one of these and a
// message you have to go looking for is a message nobody reads.
function Status({ err, saved, note, notice }: {
  err: string; saved: string; note: string; notice: RateNotice
}) {
  if (err) return (
    <p className="mb-3 rounded-lg border border-chase-edge bg-chase-bg px-3 py-2 text-[12.5px] text-chase">
      {err}
      {/* THE LIKELIEST REASON, SAID OUT LOUD. Only admins may write settings,
          and "the database refused the change" does not tell a credit officer
          that it is about who they are rather than what they typed. */}
      {err.includes('refused the change') && (
        <span className="block mt-1 text-[11.5px]">
          Changing this is admin only. Ask an administrator to turn it on, and everything else on this
          page — the applied dates against each lender — still works for you.
        </span>
      )}
    </p>
  )
  if (note) return (
    <p className="mb-3 rounded-lg border border-info-edge bg-info-bg px-3 py-2 text-[12.5px] text-info">
      {note}
    </p>
  )
  if (saved) return (
    <p className="mb-3 text-[12px] text-done">
      {saved}{notice.decisionDate ? ` The notice is about the ${niceDate(notice.decisionDate)} decision.` : ''}
    </p>
  )
  return null
}

export default function RateNoticeSettings() {
  const supabase = createSupabaseBrowser()
  const [notice, setNotice] = useState<RateNotice>(NO_NOTICE)
  const [lenders, setLenders] = useState<LenderLike[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState('')
  const [nextDate, setNextDate] = useState('')
  // Said straight after the click that caused it. See <Status/> below.
  const [note, setNote] = useState('')
  const [meName, setMeName] = useState('')

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
      // Everybody can set a date; the name is what makes a wrong one askable.
      supabase.auth.getUser().then(({ data: u }) => {
        const id = u?.user?.id
        if (!id) return
        supabase.from('user_profiles').select('full_name, email').eq('id', id).maybeSingle()
          .then(({ data: pr }: any) => setMeName(pr?.full_name || pr?.email || ''))
      })
    })
    return () => { alive = false }
  }, [])

  async function save(next: RateNotice) {
    setErr(''); setSaved(''); setNote('')
    const problem = await checkedWrite(
      supabase.from('settings').update({ rate_notice: next }).eq('id', 'singleton'),
      'The rate notice')
    if (problem) { setErr(problem); return }
    setNotice(next)
    setSaved('Saved.')
  }

  // THE APPLIED DATE, SET FROM THIS PAGE. Same two fields the Lenders page
  // writes - which decision it answers, and the day it starts - so it cannot
  // matter which screen somebody used. See lib/rate-notice.ts.
  async function setApplied(l: LenderLike, raw: string) {
    const value = raw.trim() || null
    setErr(''); setSaved(''); setNote('')
    const problem = await checkedWrite(
      supabase.from('lenders').update({
        rate_notice_for: value ? notice.decisionDate : null,
        rate_notice_from: value,
        rate_notice_by: value ? (meName || null) : null,
        rate_notice_at: value ? new Date().toISOString() : null,
      }).eq('id', l.id as string),
      'That date')
    if (problem) { setErr(problem); return }
    setLenders(prev => prev.map(x => x.id === l.id ? {
      ...x,
      rate_notice_for: value ? notice.decisionDate : null,
      rate_notice_from: value,
      rate_notice_by: value ? meName : null,
    } : x))
  }

  if (loading) return <p className="text-[13px] text-faint">Loading&hellip;</p>

  const waiting = stillCarrying(lenders, notice)
  const silent = notAnnounced(lenders, notice)
  const done = allPassedOn(lenders, notice)
  const overdue = isOverdue(notice)
  const set = (patch: Partial<RateNotice>) => setNotice(n => ({ ...n, ...patch }))

  // FOUR COUNTS, NOT A PARAGRAPH. Each is a plain filter over the same list the
  // blocks below are built from, so a number and the block under it cannot
  // disagree with each other.
  const named = lenders.filter(l => String(l.name || '').trim())
  const withDate = named.filter(l => announcedFrom(l, notice))
  const noDate = named.filter(l => !announcedFrom(l, notice))
  const applied = named.filter(l => hasTakenEffect(l, notice))
  const comingOff = withDate.filter(l => !hasTakenEffect(l, notice))

  const DATE_BOX = 'text-[12px] border rounded-md px-1.5 py-1 bg-card shrink-0'
  const LBL = 'block text-[9.5px] font-bold tracking-[.07em] uppercase text-faint mb-1.5'

  // One bank: its name and the date box, which is the only thing anybody comes
  // here to type. Three of these sit across a row instead of one.
  const bankCell = (l: any) => {
    const from = announcedFrom(l, notice)
    return (
      <div key={l.id || l.name}
        className={`flex items-center justify-between gap-2.5 px-3.5 py-2 border-b border-r border-line-soft text-[12.5px] ${
          from ? '' : 'bg-gray-50'}`}>
        <span className="font-semibold text-ink truncate">{l.name}</span>
        {/* TYPED HERE, not four clicks away on another tab. */}
        <input type="date" defaultValue={from}
          key={`${l.id}-${notice.decisionDate}-${from}`}
          onBlur={e => { if (e.target.value !== from) setApplied(l, e.target.value) }}
          aria-label={`${l.name} applies the change on`}
          className={`${DATE_BOX} ${from ? 'border-line text-ink' : 'border-dashed border-field-line text-muted'}`} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[420px_minmax(0,1fr)] gap-5 items-start max-[1150px]:grid-cols-1">

      {/* ================= the notice itself ================= */}
      <div>
        {/* WHAT HAPPENED, WHERE IT HAPPENED.
            2 Oct 2026. The team reported they "cannot flip the toggle". Nothing
            was broken: only an admin may write settings, so their click was
            refused - and the message saying so rendered at the BOTTOM of this
            panel, below all forty-odd lenders. Several screens away from the
            thing they had just pressed, which is the same as not saying it. */}
        <Status err={err} saved={saved} note={note} notice={notice} />

        <div className="bg-card border border-card-line rounded-xl overflow-hidden mb-3.5">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-line text-[10.5px] font-bold tracking-[.08em] uppercase text-muted">
            The notice
          </div>
          <div className="p-4">
            <label className={LBL}>Turn it on</label>
            <button type="button" onClick={() => {
                // TURNING IT ON WITH NO WORDS LOOKS LIKE A BROKEN SWITCH.
                //
                // lib/rate-notice.ts refuses to report `on` without text -
                // rightly, since a blank notice on a client email is worse than
                // none. But the write SUCCEEDS, so there is no error; the toggle
                // simply springs back on the next read and nothing says why.
                if (!notice.on && !notice.text.trim()) {
                  setErr(''); setSaved('')
                  setNote('Nothing to say yet, so it would not stay on. Put the wording in first — ' +
                          'the grey text below is only a suggestion, it is not saved.')
                  return
                }
                save({ ...notice, on: !notice.on })
              }}
              className={`inline-flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${
                notice.on ? 'border-done-edge bg-done-bg text-done'
                          : 'border-gray-200 bg-card text-gray-500 hover:bg-gray-50'}`}>
              <span className={`w-[34px] h-[19px] rounded-full relative shrink-0 ${notice.on ? 'bg-done' : 'bg-gray-300'}`}>
                <span className={`absolute top-[2px] w-[15px] h-[15px] rounded-full bg-card ${notice.on ? 'right-[2px]' : 'left-[2px]'}`} />
              </span>
              {notice.on
                ? (waiting.length
                    // Two numbers only when they differ. "40 still carrying it,
                    // 40 with no date yet" is one fact said twice.
                    ? silent.length === waiting.length
                      ? `On — ${waiting.length} lender${waiting.length === 1 ? '' : 's'}, none with an applied date yet`
                      : `On — ${waiting.length} still carrying it, ${silent.length} with no date yet`
                    : 'On — every lender has applied it')
                : 'Off — no notice on any email'}
            </button>

            {/* SAY WHICH ONE IS MISSING. The old line said "it needs words and a
                decision date" whichever was absent. On 2 Oct the date was set
                and the words were not, and the box below LOOKED full - the
                placeholder is a finished sentence in grey. */}
            {!notice.on && (!notice.text.trim() || !notice.decisionDate) && (
              <div className="mt-1.5 text-[11px] text-info">
                {!notice.text.trim() && (
                  <p className="m-0">
                    <strong>No wording saved yet.</strong> The grey text in the box below is a suggestion,
                    not something that has been saved — it will not go on any email.
                  </p>
                )}
                {!notice.decisionDate && (
                  <p className="m-0 mt-1">
                    <strong>No decision date yet.</strong> Without one there is no way to tick a lender off it.
                  </p>
                )}
              </div>
            )}
            {/* ONE PRESS INSTEAD OF RETYPING IT. */}
            {!notice.text.trim() && (
              <button type="button" onClick={() => save({ ...notice, text: SUGGESTED })}
                className="mt-2 rounded-lg border border-info-edge bg-info-bg px-3 py-1.5 text-[12px] font-semibold text-brand-ink">
                Use the suggested wording
              </button>
            )}

            <label className={LBL + ' mt-4'}>What it says</label>
            <textarea value={notice.text} onChange={e => set({ text: e.target.value })}
              onBlur={() => save(notice)} rows={3}
              placeholder={SUGGESTED}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed focus:outline-none focus:border-brand" />
            <p className="mt-1 text-[11px] text-gray-400">
              Your words &mdash; a cut, a hold or a different figure needs no code.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className={LBL}>Decision date</label>
                <input type="date" value={notice.decisionDate}
                  onChange={e => {
                    const d = e.target.value
                    // The review date follows the decision unless somebody has
                    // moved it themselves. Three weeks - Fabio, 30 Sep 2026:
                    // "3 weeks is perfect, like the reminder".
                    // A remind date on or before the decision itself is not a
                    // choice anybody made - it is the default failing to land.
                    const chosen = notice.reviewBy
                      && notice.reviewBy !== defaultReviewBy(notice.decisionDate)
                      && notice.reviewBy > d
                    set({ decisionDate: d, reviewBy: chosen ? notice.reviewBy : defaultReviewBy(d) })
                  }}
                  onBlur={() => save(notice)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px]" />
              </div>
              <div>
                <label className={LBL}>Remind me after</label>
                <input type="date" value={notice.reviewBy}
                  onChange={e => set({ reviewBy: e.target.value })} onBlur={() => save(notice)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px]" />
              </div>
            </div>
            {/* ONE LINE UNDER BOTH, rather than four under each. */}
            <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed">
              Changing the decision date puts every lender back on the notice, which is how the next one
              gets started. The reminder changes nothing on its own &mdash; it is when the dashboard
              starts asking about the banks that still have not given you a date. The notice never
              switches itself off.
            </p>
          </div>
        </div>

        <div className="bg-card border border-card-line rounded-xl overflow-hidden mb-3.5">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-line text-[10.5px] font-bold tracking-[.08em] uppercase text-muted">
            Where it goes
          </div>
          <p className="p-4 m-0 text-[12px] text-muted leading-relaxed">
            Every client email that quotes a rate &mdash; the borrowing capacity, the lending options,
            the pre-approval and the formal approval. <b>Nothing signed</b>, so it never outlives the
            few weeks it is about.
          </p>
        </div>

        {/* DOING IT AGAIN, TWO MONTHS FROM NOW. Fabio, 30 Sep 2026: "think
            abaout how we do that agin in 2 months tiems".
            One field. Every date a bank gave you is stamped with the decision it
            answered, so a new decision date makes all of them stop applying at
            once - there is no clear-down to run and nothing to half-finish. */}
        <div className="bg-card border border-card-line rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-line text-[10.5px] font-bold tracking-[.08em] uppercase text-muted">
            Next RBA decision
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px]" />
              <button type="button" disabled={!nextDate}
                onClick={() => { save(forNextDecision(notice, nextDate)); setNextDate('') }}
                className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-page disabled:opacity-40">
                Start it
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">
              {nextDate
                ? nextDecisionWarning(lenders, notice)
                : 'Sets the new decision date and a review three weeks on. Every date the banks gave you ' +
                  'for the last one stops applying by itself — there is nothing to clear.'}
            </p>
          </div>
        </div>
      </div>

      {/* ================= the banks ================= */}
      <div>
        {overdue && (
          <p className="mb-3 rounded-lg border border-chase-edge bg-chase-bg px-3.5 py-2.5 text-[12.5px] text-chase leading-relaxed">
            {nagLine(notice, lenders)}
          </p>
        )}
        {notice.on && done && (
          <p className="mb-3 rounded-lg border border-done-edge bg-done-bg px-3.5 py-2.5 text-[12.5px] text-done">
            Every lender has passed this one on, so it is doing nothing. Turn it off.
          </p>
        )}

        {/* THE PARAGRAPH OF TWENTY BANKS IS THESE FOUR NUMBERS.
            loadTheseRatesLine() put every name and every date into one sentence,
            directly above a list of the same banks. */}
        <div className="grid grid-cols-4 gap-2.5 mb-3.5 max-[700px]:grid-cols-2">
          {[['Lenders', named.length, ''],
            ['Have a date', withDate.length, 'text-done'],
            ['No date yet', noDate.length, 'text-chase'],
            ['Already off', applied.length, '']].map(([label, n, tone]) => (
            <div key={String(label)} className="bg-card border border-card-line rounded-xl px-4 py-3">
              <div className={`text-[26px] font-semibold tracking-[-.02em] ${tone || 'text-ink'}`}>{n}</div>
              <div className="text-[11.5px] text-muted">{label}</div>
            </div>
          ))}
        </div>

        {notice.on && (
          <>
            {/* THE ONES THAT NEED SOMEBODY, FIRST AND ON THEIR OWN.
                These are the whole reason the page exists: their clients carry
                the notice with no end date on it. */}
            {noDate.length > 0 && (
              <div className="bg-card border border-chase-edge rounded-xl overflow-hidden mb-3.5">
                <div className="flex justify-between px-4 py-2.5 bg-chase-bg border-b border-chase-edge text-[10.5px] font-bold tracking-[.08em] uppercase text-chase">
                  <span>No date yet &mdash; these run with no end</span><span>{noDate.length}</span>
                </div>
                <div className="grid grid-cols-3 max-[1500px]:grid-cols-2 max-[900px]:grid-cols-1">
                  {noDate.map(bankCell)}
                </div>
              </div>
            )}

            {comingOff.length > 0 && (
              <div className="bg-card border border-card-line rounded-xl overflow-hidden mb-3.5">
                <div className="flex justify-between px-4 py-2.5 bg-gray-50 border-b border-line text-[10.5px] font-bold tracking-[.08em] uppercase text-muted">
                  <span>Coming off</span><span>{comingOff.length}</span>
                </div>
                <p className="px-4 pt-3 pb-1 m-0 text-[11.5px] text-faint">
                  Their new rates want loading by then &mdash; the notice comes off their emails on the
                  day either way.
                </p>
                <div className="grid grid-cols-3 max-[1500px]:grid-cols-2 max-[900px]:grid-cols-1">
                  {comingOff.map(bankCell)}
                </div>
              </div>
            )}

            {applied.length > 0 && (
              <div className="bg-card border border-card-line rounded-xl overflow-hidden mb-3.5">
                <div className="flex justify-between px-4 py-2.5 bg-done-bg border-b border-done-edge text-[10.5px] font-bold tracking-[.08em] uppercase text-done">
                  <span>Applied &mdash; no notice on their emails</span><span>{applied.length}</span>
                </div>
                <div className="grid grid-cols-3 max-[1500px]:grid-cols-2 max-[900px]:grid-cols-1">
                  {applied.map(bankCell)}
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Type the date a bank tells you their change applies from. The notice comes off their
              emails on that day by itself, with nobody having to be at their desk for it. Anybody can
              set one &mdash; their name goes beside it. The same box is on each lender over in
              <b> Products &amp; policy</b>, for when you are already in there updating their rates.
            </p>
          </>
        )}

        {/* The same message again, for somebody down here among the lenders
            rather than up at the toggle. */}
        <div className="mt-3"><Status err={err} saved={saved} note={note} notice={notice} /></div>
      </div>
    </div>
  )
}
