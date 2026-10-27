import { createSupabaseServer } from './supabase-server'
import { goingOut, blockHeading, blockLead, askedLine } from './what-we-still-need'
import { stillNeedBlock } from './still-need-block'
import { signAnswers, answersUrl } from './answers-link'

// WHAT WE STILL NEED FROM THIS CLIENT, AS A BLOCK OF EMAIL.
//
// 27 Oct 2026. Catherine, Operations Manager, on why deals keep coming back:
// address history and employment history short of three years, the car, the
// super, the dependants' ages. Fabio: "I want that added to the BC email and
// then to the LO email for the ones that are still unanswered after BC email".
//
// ONE COPY, BECAUSE THERE ARE TWO EMAILS. This was written out in both routes
// first and lib/no-duplicate-logic.test.ts refused the ship with the right
// words - a fix applied to one copy is not a fix, which is how self-employed
// income stayed at $0 for five weeks. The borrowing capacity email and the
// lending options email now ask the same file.
//
// THE LIST IS WORKED OUT FRESH, never stored. Fill the gap on the fact find
// and the question is gone, and nobody has to remember to take it out. The
// only thing saved is when each question FIRST went out, which is the only
// reason the lending options email can say "I asked about this on 14 October"
// instead of sending the same sentence twice. See lib/what-we-still-need.ts.
//
// IT NEVER STOPS AN EMAIL GOING OUT. If the deal cannot be read, or the link
// cannot be signed, the block is simply not there and the email is the email
// it was yesterday. A client waiting on their numbers must not be held up by a
// question about a car.
export async function stillNeedFor(
  dealId: any,
  dropped: any,
  factFind?: any,
  today = new Date(),
): Promise<string> {
  try {
    const id = String(dealId ?? '').trim()
    if (!id) return ''
    const supabase = await createSupabaseServer()
    const { data: deal } = await supabase.from('deals').select('*').eq('id', id).single()
    if (!deal) return ''
    // THE FACT FIND ON SCREEN WINS WHERE ONE WAS SENT. Same reason the lending
    // options route reads the securities live rather than printing a copy that
    // was right last week: a question about an address somebody typed two
    // minutes ago is a question that should not be asked.
    const read = factFind ? { ...deal, fact_find_data: factFind } : deal
    const off = Array.isArray(dropped) ? dropped.map((x: any) => String(x)) : []
    const going = goingOut(read, off, today)
    if (!going.length) return ''
    // A LINK THAT CANNOT BE SIGNED IS NO LINK, NOT NO BLOCK. The questions are
    // still worth asking by reply, and the block says so either way.
    let url = ''
    try { url = answersUrl(signAnswers(String(deal.id), today)) } catch { url = '' }
    return stillNeedBlock({
      heading: blockHeading(read, going, today),
      lead: blockLead(read, going, today),
      items: going.map(q => ({ ask: q.ask, help: q.help, asked: askedLine(read, q.key, today) })),
      url,
    })
  } catch {
    return ''
  }
}
