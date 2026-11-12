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

export default function ClientAgreed({ deal }: { deal: any }) {
  const said = clientAgreed(deal)
  if (!said) return null

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
