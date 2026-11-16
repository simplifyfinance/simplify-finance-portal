// WHERE EVERY CARD WILL BE ON THE MORNING THE NEW BOARD GOES LIVE.
//
// 18 Nov 2026. Fabio: "as soon as this goes live, no deal card moves boxes,
// right? ... That's my biggest fear when we create new workflows. So the new
// workflows all stay empty."
//
// So this counts them before anything is built. It runs the REAL rule - the
// same laneOf() the board will use - over the real book, and prints how many
// cards land in each column.
//
// IT WRITES NOTHING AND PRINTS NO NAMES. Counts only, read-only, start to end.
//
// Run it yourself:
//    npx tsx scripts/where-will-they-land.ts
//
// It reads .env.local for the database address and key, so nothing is pasted
// anywhere and no key leaves the machine.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { GROUPS, laneOf } from '../lib/the-board-columns'
import { phaseOf } from '../lib/deal-phase'
import { waitingOnDocuments } from '../lib/who-has-it'

// .env.local, read here rather than adding a dependency for one script.
const env: Record<string, string> = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Everything the rule reads, and not one column more.
const NEED = [
  'id', 'is_test', 'status', 'phase_override', 'phase_override_from',
  'fact_find_data', 'bc_data',
  'client_proceeded', 'proceeded_at', 'bc_completed_at', 'bc_sent_at',
  'lo_client_proceeded', 'lo_proceeded_at', 'lo_completed_at', 'lo_sent_at',
  'compliance_completed_at', 'compliance_sent_at',
  'lodged_at', 'outstanding_at', 'preapproval_at', 'offer_accepted_at',
  'formal_approval_at', 'contracts_returned_at', 'settlement_booked_at', 'settled_at',
  'docs_received_at', 'document_progress', 'assigned_credit_officer',
].join(',')

async function main() {
  // A page at a time. The book is bigger than one answer.
  const deals: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('deals').select(NEED).order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    deals.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  const live = deals.filter(d => !d.is_test && d.status !== 'lost')
  const count: Record<string, number> = {}
  const blank: Record<string, number> = {}
  let dead = 0

  for (const d of live) {
    const lane = laneOf(d)
    if (!lane) { dead++; continue }
    count[lane] = (count[lane] || 0) + 1
    if (!d.assigned_credit_officer) blank[lane] = (blank[lane] || 0) + 1
  }

  console.log(`\n${live.length} live deals, ${deals.length} rows in the book.\n`)
  for (const g of GROUPS) {
    const tot = g.lanes.reduce((t, l) => t + (count[l.key] || 0), 0)
    console.log(`${g.title.toUpperCase()}  (${tot})`)
    for (const l of g.lanes) {
      const n = count[l.key] || 0
      const w = blank[l.key] || 0
      console.log(`   ${l.label.padEnd(22)} ${String(n).padStart(4)} cards, ${w} with nobody in credit${n === 0 ? '   <-- EMPTY ON DAY ONE' : ''}`)
    }
  }
  console.log(`\nOn no column at all: ${dead}`)

  // WHY A CARD IS IN THE "WITH CLIENT" HALF.
  //
  // Two different facts can put it there, and they are not equally reliable.
  // One is the client genuinely not having answered the BC or the options.
  // The other is that documents were asked for and "Docs received" has never
  // been pressed - which is right when it is right, and says a deal is with
  // the client forever when nobody presses the button.
  const client = live.filter(d => {
    const l = laneOf(d)
    return l === 'bc_client' || l === 'lo_client'
  })
  const docs = client.filter(waitingOnDocuments).length
  console.log(`\nOf the ${client.length} cards in a "with client" column:`)
  console.log(`   ${client.length - docs} because the client has not answered`)
  console.log(`   ${docs} because documents were asked for and never marked received`)

  // Deals on lender conditions have never had a column, so today they are on
  // no screen. They appear in Lodged - that is cards appearing, not moving.
  const cond = live.filter(d => phaseOf(d) === 'outstanding').length
  console.log(`Sitting on lender conditions, invisible on the board today: ${cond}`)

  // DOES THE BUTTON ACTUALLY GET PRESSED?
  //
  // 18 Nov 2026. Fabio: "even with client documents today, how are we even
  // tracking this? Do we actually know that we're waiting on documents?"
  //
  // The rule is one button. A card says documents when documents were asked
  // for and "Docs received" has never been pressed. So the only question that
  // matters is whether anybody presses it - and if almost nobody does, the
  // label is not a fact about the deal, it is a fact about the button.
  const asked = live.filter(d => (d.document_progress?.requests || []).length > 0)
  const back = asked.filter(d => d.docs_received_at).length
  const old30 = asked.filter(d => {
    if (d.docs_received_at) return false
    const rs = d.document_progress?.requests || []
    const last = rs.map((r: any) => String(r?.at || '')).sort().pop()
    if (!last) return false
    return (Date.now() - new Date(last).getTime()) / 86400000 > 30
  }).length

  console.log(`\nDocuments, on ${asked.length} deals where they were ever asked for:`)
  console.log(`   ${back} have had "Docs received" pressed`)
  console.log(`   ${asked.length - back} have not, so the card says documents`)
  console.log(`   ${old30} of those were last asked more than 30 days ago`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
