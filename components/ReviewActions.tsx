'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { copyHtmlAndPlain } from '@/lib/rich-text'
import { reviewEmailHtml, reviewEmailSubject } from '@/lib/portfolio-review-email'
import { OUTCOMES, REASONS, stageIndex, canSendTheEmail, greetingName } from '@/lib/portfolio-review'
import {
  makeApplicant, secondName, dealNameFromReview, factFindFromReview, dealRowFromReview,
} from '@/lib/the-review-becomes-a-deal'

// WHAT HAPPENS TO A REVIEW AFTER THE NUMBERS ARE DONE.
//
// 19 Oct 2026. Fabio, looking at 656 imported rows: "there is not section to
// update next steps???" There was not. The list could show six stages, four
// outcomes, a chase date and a count of calls, and nothing on the screen could
// set any of them - so "to chase today" and "awaiting a reply" were going to
// read 0 forever however much work got done.
//
// Three things live here, and they are the whole loop:
//   send the email, record what happened when you rang, close it out.
//
// THE EMAIL IS COPIED, NOT SENT. Fabio, 19 Oct, asked for the same path every
// other client email in this portal takes: copy, paste into Outlook. It lands
// in his sent items and the reply comes back to him, which a notifications@
// address cannot do. The cost is that "Template sent" is a person saying so -
// which is why one button copies AND marks, rather than leaving a tick box
// beside it that somebody forgets.

const IN = 'w-full border border-card-line rounded-lg px-2.5 py-[7px] text-[13px] bg-card text-ink '
  + 'focus:outline-none focus:border-brand'
const LAB = 'block text-[11.5px] text-muted mb-1'
const K = 'text-[9.5px] font-bold uppercase tracking-[.06em] text-faint'
const BTN = 'text-[12px] border border-card-line bg-card rounded-lg px-3 py-[7px] text-ink hover:bg-page transition disabled:opacity-40'
const DARK = 'text-[12px] bg-ink text-page rounded-lg px-3.5 py-[7px] font-semibold disabled:opacity-40'

const KINDS = ['call', 'email', 'text', 'meeting', 'note'] as const

const asDate = (d: Date) => d.toISOString().slice(0, 10)
const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return asDate(d)
}

export default function ReviewActions({ review, figures, properties, broker, copy, onDone }: {
  review: any
  figures: any
  // The whole property rows, not just a name and an address: the deal that
  // comes out of a good review is seeded with the lender, the balance and the
  // value on each one. See lib/the-review-becomes-a-deal.ts.
  properties: any[]
  broker: { name: string; calendly: string; title?: string }
  copy?: any
  onDone?: () => void
}) {
  // Same two names, same reason as ReviewFigures: the list view renames the
  // review's own id so it can carry client_id beside it.
  const reviewId = String(review?.review_id || review?.id || '')

  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState('')
  const [said, setSaid] = useState('')
  const [preview, setPreview] = useState(false)
  const [logging, setLogging] = useState(false)
  const [closing, setClosing] = useState(false)

  const [c, setC] = useState({
    kind: 'call' as typeof KINDS[number],
    what: '',
    outcome: '',
    next_action_on: inDays(7),
  })
  const [close, setClose] = useState({
    outcome: 'not_suitable', reason: '', note: '', next_review_date: inDays(365),
  })

  const equityProp = properties.find(p => p.id === figures?.equity_property_id)
  // BOTH OF THEM, WHERE THERE ARE TWO. 225 of the 656 are a couple, and
  // sending to whichever name the CRM put first is how one of them hears about
  // their own money second hand.
  const to = [review.email || figures?.book_email, figures?.book_email2]
    .map(v => String(v || '').trim()).filter(v => v.includes('@'))
  const toLine = Array.from(new Set(to)).join(',')

  // BUILT HERE, EVERY TIME IT IS ASKED FOR, NEVER STORED.
  //
  // A saved copy of an email is a copy that was right last week - the same
  // fault lib/notes-freshness.ts exists for. Change a figure, press preview,
  // and the figure has changed.
  const html = () => reviewEmailHtml({
    greeting: greetingName(review.first_name, review.last_name),
    equityAddress: equityProp?.address || '',
    purchasePrice: figures?.purchase_price,
    stampDuty: figures?.stamp_duty,
    loanAmount: figures?.loan_amount,
    loanNote: figures?.loan_note || '',
    equityRelease: figures?.equity_release,
    savings: figures?.savings_contribution,
    buffer: figures?.equity_buffer,
    brokerName: broker.name,
    brokerTitle: broker.title,
    calendlyUrl: broker.calendly,
    copy,
  })

  const can = canSendTheEmail({ ...review, ...figures }, { email: toLine })

  async function sendIt() {
    if (!reviewId) { setWhy('This review has no id, so nothing can be saved against it.'); return }
    setBusy(true); setWhy(''); setSaid('')
    try {
      await copyHtmlAndPlain(html())
      const supabase = createSupabaseBrowser()
      const { data: me } = await supabase.auth.getUser()
      const now = new Date().toISOString()

      // WRITTEN BEFORE THE MAILTO, NOT AFTER.
      //
      // Handing the browser a mailto: aborts requests already in flight. The
      // lending options email was marked sent while nothing landed for exactly
      // this reason, and the deal sat waiting on a broker who had already sent
      // it. See sendEmail in LOForm.tsx.
      const patch: any = { email_sent_at: now, email_sent_by: me?.user?.id || null, updated_at: now }
      if (stageIndex(review.status) < stageIndex('template_sent')) patch.status = 'template_sent'
      const { data, error } = await supabase.from('portfolio_reviews')
        .update(patch).eq('id', reviewId).select('id')
      if (error || !data?.length) {
        setWhy(error?.message
          || 'The email was copied, but the review was not marked as sent. Nothing was saved.')
        setBusy(false)
        return
      }

      // AND A CHASE, SO IT CANNOT GO QUIET.
      //
      // An email that goes out with nothing to chase is a client nobody follows
      // up. One week, logged as a contact like any other, so it shows in the
      // history and drives "to chase today".
      const { error: chaseErr } = await supabase.from('portfolio_review_contacts').insert({
        review_id: reviewId, client_id: review.client_id || null,
        kind: 'email', what: 'Opportunity email sent',
        next_action_on: inDays(7), created_by: me?.user?.id || null,
      })
      // The email is copied and the review says sent, which is the part the
      // client is affected by. A missing chase is a client who goes quiet, so
      // it is said rather than swallowed - and set by hand with Log a call.
      if (chaseErr) {
        setWhy(`Copied and marked as sent, but the chase was not set — ${chaseErr.message}. `
          + 'Use Log a call to put one in.')
      }

      setSaid('Copied. Paste into Outlook with Cmd+V. Marked as sent, chase set for a week.')
      onDone?.()
      if (toLine) {
        window.location.href = `mailto:${encodeURIComponent(toLine)}`
          + `?subject=${encodeURIComponent(reviewEmailSubject())}`
      }
    } catch (e: any) {
      setWhy(e?.message || 'Could not copy the email.')
    } finally { setBusy(false) }
  }

  async function logIt() {
    if (!reviewId) { setWhy('This review has no id, so nothing can be saved against it.'); return }
    setBusy(true); setWhy('')
    const supabase = createSupabaseBrowser()
    const { data: me } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('portfolio_review_contacts').insert({
      review_id: reviewId, client_id: review.client_id || null,
      kind: c.kind, what: c.what, outcome: c.outcome || null,
      next_action_on: c.next_action_on || null, created_by: me?.user?.id || null,
    }).select('id')
    if (error || !data?.length) {
      setWhy(error?.message || 'That would not save. Nothing was recorded.')
      setBusy(false); return
    }
    // THEY ANSWERED, SO THE REVIEW SAYS SO. Only ever forward: a later call on
    // a closed review does not reopen it, and a call before the email went out
    // does not pretend they replied to it.
    if (c.outcome
        && stageIndex(review.status) >= stageIndex('template_sent')
        && stageIndex(review.status) < stageIndex('client_responded')) {
      const { error: stageErr } = await supabase.from('portfolio_reviews')
        .update({ status: 'client_responded', updated_at: new Date().toISOString() })
        .eq('id', reviewId)
      // The call itself is already recorded, which is the part that matters.
      // A stage that did not move is worth saying out loud rather than
      // throwing away the contact that did save.
      if (stageErr) setWhy(`The call was saved, but the stage did not move — ${stageErr.message}`)
    }
    setBusy(false); setLogging(false)
    setC({ kind: 'call', what: '', outcome: '', next_action_on: inDays(7) })
    onDone?.()
  }

  // A GOOD ONE BECOMES A DEAL, IN ONE PRESS.
  //
  // 26 Oct 2026, Fabio on the half of the process that was never finished:
  // "we were going to log calls and if successful I would create a deal card
  // in one upload current fact find and register as a new lead".
  //
  // Everything the deal needs is already on this screen. What it used to take
  // was somebody opening the new deal modal and typing the name, the second
  // applicant, the broker and every security in again by hand.
  const [making, setMaking] = useState(false)

  const first = String(review?.first_name ?? '').trim()
  const last = String(review?.last_name ?? '').trim()
  const alsoCalled = secondName(review?.book_name, first, last)
  const willBeCalled = dealNameFromReview(first, last, alsoCalled, new Date().getFullYear())

  async function createTheDeal() {
    if (!reviewId) { setWhy('This review has no id, so nothing can be saved against it.'); return }
    setBusy(true); setWhy('')
    const supabase = createSupabaseBrowser()
    const email = String(review?.email || figures?.book_email || '').trim()
    const phone = String(review?.phone || figures?.book_phone || '').trim()

    // A BOOK ROW IS NOT A CLIENT YET. Most of the 656 are not - see
    // docs/portfolio-review-stands-alone.sql. One is created here, the same as
    // the new deal modal does, because everything that writes a position is
    // gated on the applicant carrying a client id.
    let clientId: string | null = review?.client_id || null
    if (!clientId) {
      const { data: made } = await supabase.from('clients').insert([{
        first_name: first, last_name: last, email: email || null, phone: phone || null,
      }]).select('id').single()
      clientId = (made as any)?.id || null
    }

    let secondId: string | undefined
    if (alsoCalled) {
      const { data: made2 } = await supabase.from('clients').insert([{
        first_name: alsoCalled.first, last_name: alsoCalled.last,
        email: String(figures?.book_email2 || '').trim() || null,
        phone: String(figures?.book_phone2 || '').trim() || null,
      }]).select('id').single()
      secondId = (made2 as any)?.id || undefined
    }

    const applicants = [makeApplicant(first, last, email, phone, clientId || undefined)]
    if (alsoCalled) {
      applicants.push(makeApplicant(alsoCalled.first, alsoCalled.last,
        String(figures?.book_email2 || '').trim(), String(figures?.book_phone2 || '').trim(), secondId))
    }

    const row = dealRowFromReview({
      dealName: willBeCalled,
      clientId,
      brokerKey: review?.book_broker_key,
      factFind: factFindFromReview(applicants, properties || []),
    })

    const { data: deal, error } = await supabase.from('deals').insert([row]).select('id').single()
    if (error || !deal) {
      setBusy(false)
      setWhy(error?.message || 'The deal was not created. Nothing was changed.')
      return
    }

    // AND THE REVIEW SAYS WHAT BECAME OF IT. linked_deal_id has been read on
    // the list since the day it was built and written nowhere until now.
    const now = new Date().toISOString()
    const { error: linkErr } = await supabase.from('portfolio_reviews').update({
      linked_deal_id: (deal as any).id,
      status: 'closed', outcome: 'converted',
      closed_at: now, reviewed_at: now, updated_at: now,
    }).eq('id', reviewId)
    setBusy(false)
    // The deal exists either way. Losing the link is worth saying out loud and
    // is not worth throwing the deal away over.
    if (linkErr) { setWhy('The deal was created, but the review was not marked. Say so and it gets fixed.'); return }
    window.location.href = `/deals/${(deal as any).id}`
  }

  async function closeIt() {
    if (!reviewId) { setWhy('This review has no id, so nothing can be saved against it.'); return }
    setBusy(true); setWhy('')
    const supabase = createSupabaseBrowser()
    const { data: me } = await supabase.auth.getUser()
    // EVERY OUTCOME SETS A NEXT REVIEW DATE, including "became a deal". Not now
    // is almost never not ever, and a client who drops off this list is a
    // client nobody rings again.
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('portfolio_reviews').update({
      status: 'closed', outcome: close.outcome,
      // WHY, IN A WORD AND IN YOUR OWN WORDS. The word is what a report can
      // count; the note is what the next person actually needs to read before
      // they ring. Null rather than '' on the reason, so "nobody said" and
      // "they said something else" stay different things.
      outcome_reason: close.reason || null,
      outcome_note: close.note || '',
      closed_at: now,
      next_review_date: close.next_review_date || null,
      reviewer: me?.user?.id || null, reviewed_at: now,
      updated_at: now,
    }).eq('id', reviewId).select('id')
    if (error || !data?.length) {
      setWhy(error?.message || 'That would not save. Nothing was recorded.')
      setBusy(false); return
    }
    setBusy(false); setClosing(false)
    onDone?.()
  }

  return (
    <div className="border-t border-line-soft pt-3.5 mt-3.5">
      <p className={`${K} mb-2.5`}>What happens next</p>

      <div className="flex gap-2 flex-wrap">
        <button className={BTN} onClick={() => setPreview(v => !v)}>
          {preview ? 'Close the preview' : 'Preview the email'}
        </button>
        <button className={DARK} disabled={busy || !can.ok} onClick={sendIt}>
          {busy ? 'Copying…' : 'Copy and mark as sent'}
        </button>
        <button className={BTN} onClick={() => { setLogging(v => !v); setClosing(false) }}>
          Log a call
        </button>
        {/* THE OTHER HALF OF THE PROCESS. Log the calls, and when one goes
            well, one press builds the deal. 26 Oct 2026. */}
        {!review?.linked_deal_id && (
          <button className={BTN} onClick={() => { setMaking(v => !v); setClosing(false); setLogging(false) }}>
            Became a deal
          </button>
        )}
        {review?.linked_deal_id && (
          <a href={`/deals/${review.linked_deal_id}`}
            className="text-[12px] border border-done-edge bg-done-bg text-done rounded-lg px-3 py-[7px] font-semibold">
            Open the deal
          </a>
        )}
        <button className={BTN} onClick={() => { setClosing(v => !v); setLogging(false); setMaking(false) }}>
          Close this out
        </button>
      </div>

      {/* WHY THE BUTTON IS OFF, in words somebody can act on. A greyed button
          with no reason beside it is a phone call to me. */}
      {!can.ok && <p className="text-[11.5px] text-faint mt-2">{can.why}</p>}
      {said && <p className="text-[11.5px] text-done mt-2">{said}</p>}
      {why && <p className="text-[11.5px] text-chase mt-2">{why}</p>}

      {preview && (
        <div className="mt-3 border border-card-line rounded-lg overflow-hidden bg-white">
          <iframe title="The opportunity email" srcDoc={html()}
            className="w-full h-[520px] border-0" />
        </div>
      )}

      {logging && (
        <div className="mt-3 bg-page border border-g100 rounded-lg p-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className={LAB}>What was it</label>
              <select className={IN} value={c.kind}
                onChange={e => setC({ ...c, kind: e.target.value as any })}>
                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select></div>
            <div><label className={LAB}>Chase again on</label>
              <input type="date" className={IN} value={c.next_action_on}
                onChange={e => setC({ ...c, next_action_on: e.target.value })} /></div>
          </div>
          <div className="mt-2.5"><label className={LAB}>What happened</label>
            <input className={IN} value={c.what} placeholder="No answer, left a message"
              onChange={e => setC({ ...c, what: e.target.value })} /></div>
          {/* ONLY FILLED IN ON THE ONE THAT GOT SOMEWHERE. Left empty on "no
              answer", which is what keeps the review out of "client responded"
              and leaves it on the chase list where it belongs. */}
          <div className="mt-2.5"><label className={LAB}>What they said, if you got through</label>
            <input className={IN} value={c.outcome} placeholder="Interested, wants to talk in the new year"
              onChange={e => setC({ ...c, outcome: e.target.value })} /></div>
          <div className="flex gap-2 mt-3 items-center">
            <button className={DARK} disabled={busy} onClick={logIt}>
              {busy ? 'Saving…' : 'Save it'}</button>
            <button className={BTN} onClick={() => setLogging(false)}>Cancel</button>
            <span className="flex-1" />
            <button className={BTN} onClick={() => setC({ ...c, next_action_on: '' })}>
              No chase needed</button>
          </div>
        </div>
      )}

      {making && (
        <div className="mt-3 bg-page border border-g100 rounded-lg p-3.5">
          <label className={LAB}>This builds the deal from what is already here</label>
          <ul className="text-[12.5px] text-body leading-relaxed list-disc pl-4 mb-2.5">
            <li><b className="text-ink">{willBeCalled}</b></li>
            <li>{alsoCalled ? 'Both applicants' : 'One applicant'}, with the email and phone on file</li>
            <li>{(properties || []).length} {(properties || []).length === 1 ? 'security' : 'securities'} on the
              fact find, with the lender, the balance and the value on each</li>
            <li>Registered as a new lead from the portfolio review</li>
            <li>This review marked as became a deal, and linked to it</li>
          </ul>
          <p className="text-[11px] text-faint mb-2.5 leading-relaxed">
            It opens on the Fact Find. Everything on it can be changed there — nothing here is final.
          </p>
          <div className="flex gap-2">
            <button className={DARK} disabled={busy} onClick={createTheDeal}>
              {busy ? 'Building it…' : 'Create the deal card'}
            </button>
            <button className={BTN} onClick={() => setMaking(false)}>Cancel</button>
          </div>
        </div>
      )}

      {closing && (
        <div className="mt-3 bg-page border border-g100 rounded-lg p-3.5">
          <label className={LAB}>How did it end?</label>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {OUTCOMES.map(o => (
              <button key={o.key} onClick={() => setClose({ ...close, outcome: o.key })}
                className={`text-[12px] rounded-lg px-3 py-[6px] border transition ${
                  close.outcome === o.key
                    ? 'border-brand text-brand-ink bg-brand/5 font-medium'
                    : 'border-card-line text-muted hover:bg-card'}`}>
                {o.label}
              </button>
            ))}
          </div>
          {/* WHY, AND THEN IN YOUR OWN WORDS.
              26 Oct 2026. Four outcomes were the whole record of six hundred
              conversations. The reason is the half a report can add up; the
              note is the half the next person needs before they ring. Asked
              to pick one, Fabio took both. See REASONS in
              lib/portfolio-review.ts. */}
          <label className={LAB}>Why</label>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {REASONS.map(r => (
              <button key={r.key}
                onClick={() => setClose({ ...close, reason: close.reason === r.key ? '' : r.key })}
                className={`text-[12px] rounded-lg px-3 py-[6px] border transition ${
                  close.reason === r.key
                    ? 'border-brand text-brand-ink bg-brand/5 font-medium'
                    : 'border-card-line text-muted hover:bg-card'}`}>
                {r.label}
              </button>
            ))}
          </div>

          <label className={LAB}>In your words</label>
          <textarea className={`${IN} h-16 resize-none`} value={close.note}
            placeholder="Second income starts in July. Worth a call once two payslips are in."
            onChange={e => setClose({ ...close, note: e.target.value })} />

          <label className={LAB}>Come back to them on</label>
          <input type="date" className={IN} value={close.next_review_date}
            onChange={e => setClose({ ...close, next_review_date: e.target.value })} />
          <p className="text-[11px] text-faint mt-1.5 leading-relaxed">
            Every outcome gets one, including &ldquo;became a deal&rdquo;. When the day comes
            they come back on the list with what you wrote here.
          </p>
          <div className="flex gap-2 mt-3">
            <button className={DARK} disabled={busy} onClick={closeIt}>
              {busy ? 'Saving…' : 'Close it'}</button>
            <button className={BTN} onClick={() => setClosing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
