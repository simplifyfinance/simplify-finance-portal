'use client'

// Placeholder with the facts in it, so the pane is worth opening before it is built.
export default function AiExpenses() {
  const will = [
    { h: 'Spend this month', d: 'Running total, against a budget you set.' },
    { h: 'By person', d: 'Who is generating what. AI notes are the bulk of it.' },
    { h: 'By feature', d: 'Compliance, client emails, lender extraction, fact find.' },
    { h: 'Cost per deal', d: 'What a deal costs to run through the portal end to end.' },
  ]
  const needs = [
    'A usage table — one row per AI call: who, which deal, which feature, model, tokens in and out.',
    'Three lines added to each of the six routes that call Anthropic.',
    'A per-model price list in Settings, because rates change and a hardcoded number goes stale quietly.',
  ]
  return (
    <div className="bg-white border border-[#EDE7DD] rounded-xl p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-[.06em] bg-[#EAF7FE] border border-[#BFE6F9] text-[#0E8FCB] rounded-full px-2.5 py-[3px]">
          Coming soon
        </span>
        <span className="text-[13px] font-semibold text-[#2E2A26]">Not built yet</span>
      </div>
      <p className="text-[12.5px] text-[#6E665C] max-w-[74ch] mb-5">
        Nothing in the portal currently records that an AI call happened, so there is no data to show. Once the
        logging is in, this pane fills up on its own.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {will.map(i => (
          <div key={i.h} className="border border-[#EDE7DD] rounded-xl p-3.5 bg-[#FDFCFA]">
            <div className="text-[12.5px] font-semibold text-[#2E2A26] mb-0.5">{i.h}</div>
            <div className="text-[11.5px] text-[#A29889]">{i.d}</div>
          </div>
        ))}
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-[#A29889] mb-2">What it needs first</div>
      <ul className="mb-5 space-y-1.5">
        {needs.map(n => (
          <li key={n} className="text-[12.5px] text-[#6E665C] flex gap-2.5">
            <span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0 mt-[7px]" />
            <span>{n}</span>
          </li>
        ))}
      </ul>

      <div className="bg-[#FDF6E7] border border-[#EFE0BC] rounded-xl px-4 py-3">
        <div className="text-[12.5px] text-[#7A5F17]">
          <strong className="text-[#5E4A11]">Two things to know before it lands.</strong> It can only count from
          the day it ships — there is no way to recover calls already made, so earlier months have to come from
          the Anthropic console. And it measures the portal's own calls, not your whole account, so the figure
          here will be lower than the invoice if anything else uses the API.
        </div>
      </div>
    </div>
  )
}
