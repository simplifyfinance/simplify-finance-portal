'use client'
import { clientAgreed } from '@/lib/the-client-agreed'

// THE GREEN LINE AT THE TOP OF A LIVE DEAL.
//
// 12 Nov 2026. Fabio: "brokers are saying it's not clear the client agreed and
// pressed buttons to proceed."
//
// Everything this draws was already in the database and already readable. It
// was shown inside the BC tab and inside the LO tab, which is the one place a
// broker never looks once a stage is behind them. The rule here is only that
// it comes out to where they land.
//
// GREEN, NOT RED. Nothing on this line needs doing. It is a thing that went
// right, said once, where it can be seen. Red on this page means act today and
// it is not being spent on good news.
//
// WHY THE WORDS MATTER MORE THAN THE BOX. "From their own page" is the
// difference between the client agreeing and the office deciding they had.
// Where the office recorded it the line names the person instead, which is
// just as useful and a great deal more honest than a tick that means neither.

// TWO PLACES, AND THEY DO DIFFERENT JOBS.
//
// 16 Nov 2026. Fabio: "once the client has agreed to proceed with the BC and
// we're in compliance, why is that still there between compliance and
// settlement and settled?" He was right - a green band carried for three weeks
// stops being news and starts being furniture.
//
// He picked B with A on top of it. So:
//
//   band  the green line, ON THE DAY IT HAPPENS ONLY. That is the day a broker
//         needs to see it without looking for it. Tomorrow it is gone.
//   row   a line in the deal box, which does not expire. It is a fact about
//         the deal, like the broker's name, and it is read when somebody asks
//         rather than shouted every time the page opens.
export default function ClientAgreed({ deal, mode = 'band' }: {
  deal: any
  mode?: 'band' | 'row'
}) {
  const said = clientAgreed(deal)
  if (!said) return null

  // A LINE IN THE DEAL BOX. Never expires, never shouts.
  if (mode === 'row') return (
    <div className="flex items-baseline gap-3 py-1.5 text-[13px] text-ink border-t border-line">
      <span className="text-[9px] font-extrabold tracking-[.11em] uppercase text-faint
                       w-[104px] shrink-0">Client agreed</span>
      <span>
        {said.what.replace(/^The client /, '')}
        {said.day ? <span className="text-muted"> &middot; {said.day}</span> : null}
        <span className="text-faint">, {said.how}</span>
      </span>
    </div>
  )

  // THE BAND, ON THE DAY. Anything older than today is a row and nothing else.
  if (said.days !== 0) return null

  return (
    <div className="flex items-center gap-2.5 bg-done-bg border border-done-edge rounded-[10px]
      px-3.5 py-2.5 mt-3 flex-wrap">
      <span className="w-[17px] h-[17px] rounded-full bg-done text-page text-[11px] font-bold
        flex items-center justify-center shrink-0" aria-hidden="true">✓</span>
      <span className="text-[13px] text-done">
        <b className="font-bold">{said.what}</b>
        {said.day ? <> — {said.day}</> : null}
        <span className="opacity-80">, {said.how}</span>
      </span>
      <span className="ml-auto text-[11.5px] text-done opacity-80 whitespace-nowrap">
        {said.aside}
      </span>
    </div>
  )
}
