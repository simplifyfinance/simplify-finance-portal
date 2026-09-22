'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { checkedWrite } from '@/lib/checked-write'
import {
  positionFor, countIn, wouldEmptyTheClient, emptyRefusal, applicantName,
  type Applicant,
} from '@/lib/client-position'

// RECORDING WHAT A CLIENT OWNS, AT THE MOMENT A DEAL SETTLES.
//
// This is the only capture that can include the loan you just wrote. Everything
// before it - the compliance push, a deal being closed - records the position as
// the client DECLARED it, which by definition does not contain your own lending.
// A book made only of those can never answer "who is with ubank", because your
// own settlements are not in it.
//
// Asked, not automatic. Fabio, 22 Sep 2026: whether this deal's figures are the
// fuller picture is a judgement that changes from client to client, so it is a
// real question with two real answers - unlike the tab notice, where one answer
// was always right.

export default function PositionAtSettlement({ deal, onDone }: {
  deal: any
  onDone: () => void
}) {
  const factFind = deal?.fact_find_data || {}
  const all: Applicant[] = (factFind.applicants || []).filter((a: any) => a && a.id)
  // Only somebody with a client record can hold a position. Since 22 Sep every
  // applicant is given one when the deal is created, and the deals already in
  // the book were linked by docs/client-link-backfill.sql.
  const linked = all.filter(a => a.clientId)

  const [choice, setChoice] = useState<Record<string, boolean>>(
    Object.fromEntries(linked.map(a => [a.id, true])))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // The position saved but its history row did not. Said out loud, and NOT
  // treated as a failed save - see the note where it is set.
  const [historyWarning, setHistoryWarning] = useState('')

  if (linked.length === 0) return null

  async function save() {
    setBusy(true); setErr('')
    for (const applicant of linked) {
      if (!choice[applicant.id]) continue
      const next = positionFor(factFind, applicant)

      // WHAT THEY HOLD NOW, read before writing over it.
      const { data: existing } = await supabase.from('clients')
        .select('position_properties, position_liabilities, position_assets')
        .eq('id', applicant.clientId).maybeSingle()

      if (wouldEmptyTheClient(existing as any, next)) {
        setBusy(false)
        setErr(emptyRefusal(applicantName(applicant), existing))
        return
      }

      const { data: who } = await supabase.auth.getUser()
      const now = new Date().toISOString()

      // THE HISTORY FIRST. A row here costs nothing and makes "what did they
      // look like before this loan" a question with an answer.
      //
      // CHECKED, BUT NOT FATAL. This table has existed since the portal was
      // built - indexed, with its policies - and has never once been written
      // to, so its policy has never been exercised. A refusal returns zero rows
      // and no error, which is exactly how this would fail invisibly on the
      // very first settlement and stay broken for months.
      //
      // So it is checked and said out loud. It does not stop the save: refusing
      // to record a client's position because the history table would not take
      // a copy loses the thing that matters to keep the thing that is nice to
      // have. The warning names it instead.
      const historyProblem = await checkedWrite(supabase.from('client_positions').insert({
        client_id: applicant.clientId,
        deal_id: deal.id,
        captured_from: 'settlement',
        properties: next.properties,
        liabilities: next.liabilities,
        assets: next.assets,
      }), `The history of ${applicantName(applicant)}'s position`)

      // Checked: row level security returns zero rows and no error when it
      // refuses a write, so "no error" is not the same as "it happened".
      const problem = await checkedWrite(supabase.from('clients').update({
        position_properties: next.properties,
        position_liabilities: next.liabilities,
        position_assets: next.assets,
        position_updated_at: now,
        position_updated_from_deal_id: deal.id,
        position_source: 'settlement',
        position_updated_by: who?.user?.id || null,
      }).eq('id', applicant.clientId), `${applicantName(applicant)}'s position`)

      if (problem) { setBusy(false); setErr(problem); return }
      if (historyProblem) setHistoryWarning(historyProblem + ' The position itself WAS saved. Please tell Fabio.')
    }
    setBusy(false)
    // A history row that would not write is worth reading before the box
    // closes, so the person has to shut it themselves.
    if (!historyWarning) onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-[540px] max-h-[88vh] overflow-y-auto shadow-xl">
        <div className="text-[15.5px] font-semibold mb-1">Update the client record?</div>
        <p className="text-[12.5px] text-gray-500 leading-relaxed mb-4">
          This deal has settled. Replacing a client&rsquo;s position writes what this Fact Find
          holds &mdash; including the loan that just settled &mdash; over what is on their record today.
        </p>

        {linked.map(a => {
          const next = positionFor(factFind, a)
          const yes = !!choice[a.id]
          return (
            <div key={a.id} className="border border-gray-100 rounded-xl px-3.5 py-3 mb-2.5 bg-[#FCFDFD]">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[13.5px] font-semibold">{applicantName(a)}</span>
                <span className="ml-auto flex gap-1.5">
                  <button onClick={() => setChoice(p => ({ ...p, [a.id]: true }))}
                    className={`text-[12px] rounded-md px-3 py-1 border ${yes ? 'bg-[#2DBEFF] border-[#2DBEFF] text-white font-semibold' : 'border-gray-200 text-gray-500'}`}>
                    Replace
                  </button>
                  <button onClick={() => setChoice(p => ({ ...p, [a.id]: false }))}
                    className={`text-[12px] rounded-md px-3 py-1 border ${!yes ? 'bg-[#8B959D] border-[#8B959D] text-white font-semibold' : 'border-gray-200 text-gray-500'}`}>
                    Leave it
                  </button>
                </span>
              </div>
              {/* WHAT WOULD CHANGE, BEFORE THEY ANSWER. A yes/no with nothing
                  behind it is a guess. These counts are read off this deal, so
                  the prompt cannot claim something the save will not do. */}
              <div className="text-[12px] text-gray-500 mt-2 pt-2 border-t border-dashed border-gray-100 leading-relaxed">
                <b className="text-gray-700">
                  {next.properties.length} propert{next.properties.length === 1 ? 'y' : 'ies'} &middot;{' '}
                  {next.liabilities.length} liabilit{next.liabilities.length === 1 ? 'y' : 'ies'} &middot;{' '}
                  {next.assets.length} asset{next.assets.length === 1 ? '' : 's'}
                </b>
                {countIn(next) === 0 && (
                  <span className="block mt-1 text-[#B45309]">
                    Nothing on this Fact Find is recorded as theirs. Saving this would leave their record empty.
                  </span>
                )}
                {next.unconfirmed > 0 && (
                  <span className="block mt-1 text-[#B45309]">
                    {next.unconfirmed} {next.unconfirmed === 1 ? 'item has' : 'items have'} nobody
                    recorded as the owner. {next.unconfirmed === 1 ? 'It is' : 'They are'} going on
                    both records, marked as needing confirming, rather than being dropped.
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {historyWarning && (
          <div className="bg-[#FFF8EC] border border-[#F0DCB4] text-[#92400E] rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed mb-3">
            {historyWarning}
          </div>
        )}
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed mb-3">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-3">
          {/* A real answer. The settlement is recorded either way, and the client
              page shows the position is behind a settled deal - so it comes back
              rather than disappearing. */}
          <button onClick={onDone} disabled={busy}
            className="px-4 py-2 text-[12.5px] border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            Not now
          </button>
          <button onClick={save} disabled={busy}
            className="px-4 py-2 text-[12.5px] bg-[#343333] text-white rounded-lg font-semibold hover:bg-[#2a2a2a] disabled:opacity-40">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
