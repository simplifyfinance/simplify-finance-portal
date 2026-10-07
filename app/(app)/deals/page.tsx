'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { seedFromClients, seedSummary } from '@/lib/seed-from-client'
import { dealMatches } from '@/lib/deal-search'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { Plus, Search, Briefcase, Trash2, Copy } from 'lucide-react'
import { DeleteDealDialog } from '@/components/DeleteDealDialog'
import { checkedWrite } from '@/lib/checked-write'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getWaitingOnLabel, WAITING_ON_STYLES } from '@/lib/deal-status'
import { ageGroupOf, stageAge, GROUP_ORDER, GROUP_STYLE } from '@/lib/deal-age'
import { useBrokerNames } from '@/lib/broker-names'
import { phaseOf, derivedPhaseOf, isFinished, isInApplication, PHASE_LABEL } from '@/lib/deal-phase'
import DealBoard from '@/components/DealBoard'
import BoardFilters, { BoardFilterBar } from '@/components/BoardFilters'
import { useBoardFilters } from '@/lib/use-board-filters'
import { applyFilters, type BoardView, type ViewKey } from '@/lib/board-filters'
import {
  TILE_KEYS, TILE_LABEL, closedLine, matchesTile, readyStageFor, reviewSplit,
  tileCounts, cardTone, type TileKey,
} from '@/lib/board-tiles'
import { useBoardSettings } from '@/lib/use-board-settings'
import type { Alert } from '@/lib/deal-notes'
import { realDealsOnly, testDealsOnly } from '@/lib/test-deal'
import DealName from '@/components/DealName'
import { otherDealsForSameClients } from '@/lib/same-clients'

type Client = { id: string; first_name: string; last_name: string; email?: string; phone?: string }
type Deal = {
  id: string; deal_name: string; deal_type: string; stage: string; status: string; assigned_broker: string;
  created_at: string; clients: Client; client_proceeded?: boolean
  bc_completed_at?: string | null; lo_completed_at?: string | null; compliance_completed_at?: string | null
  is_test?: boolean | null
  client_id?: string | null
  fact_find_data?: any
}
export default function DealsPage() {
  const browser = createSupabaseBrowser()
  const router = useRouter()
  const { nameFor } = useBrokerNames()
  // Label colours, broker colours and the stale thresholds, all from Settings.
  // Until somebody sets them this is exactly what the code used before there was
  // a screen for it, so the board looks the same on an unmigrated portal.
  const { look } = useBoardSettings()
  // Open alerts for every deal on screen, in one query. This is the whole point
  // of an alert: it has to be visible to somebody who was not going to open that
  // deal. An empty result is normal and the board just draws no chips.
  const [alerts, setAlerts] = useState<Record<string, Alert[]>>({})
  useEffect(() => {
    browser.from('deal_alerts').select('*').is('resolved_at', null).limit(2000)
      .then(({ data }) => {
        const m: Record<string, Alert[]> = {}
        for (const a of ((data as any[]) || [])) (m[a.deal_id] ||= []).push(a as Alert)
        setAlerts(m)
      })
  }, [])
  const [deals, setDeals] = useState<Deal[]>([])
  // ANOTHER DEAL FOR THE SAME PEOPLE.
  //
  // The list already holds every deal this person may see, so this costs a pass
  // over an array rather than a query. 23 Sep 2026: two Hameed deals sat
  // together in this list and the wrong one was opened. See lib/same-clients.ts.
  const twins = useMemo(() => {
    const out = new Map<string, Deal[]>()
    for (const d of deals) out.set(d.id, otherDealsForSameClients(d as any, deals as any) as any)
    return out
  }, [deals])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [brokerKey, setBrokerKey] = useState<string | null>(null)
  // WHICH TILE IS PRESSED. 'all' is not a filter, it is the absence of one.
  // Was 'all' | 'bc' | 'lo' | 'compliance'; the two review tiles became one and
  // "In application" became "Waiting on someone". See lib/board-tiles.ts, which
  // holds every one of those rules so the tile and the cards cannot disagree.
  const [tile, setTile] = useState<TileKey>('all')
  // TEST DEALS ARE HIDDEN UNTIL ASKED FOR, AND THEN THEY ARE ALL THAT SHOWS.
  //
  // Not a chip on a card mixed in among real deals - somebody scanning the
  // board reads shape, not labels. Off, the book is the real book. On, it is
  // the test deals and nothing else, in one place, with a delete on each.
  const [showTests, setShowTests] = useState(false)
  useEffect(() => {
    browser.auth.getUser().then(({ data: { user } }) => {
      if (!user) { fetchDeals(); return }
      browser.from('user_profiles').select('role, broker_key').eq('id', user.id).single()
        .then(async ({ data }) => {
          const role = data?.role || 'staff'
          const broker = data?.broker_key || null
          setUserRole(role)
          setBrokerKey(broker)
          // The credit officer lookup that used to happen here existed only to
          // narrow this list down to a staff member's own files. Staff see the
          // whole book now, so it was a round trip whose answer was thrown away.
          fetchDeals(role, broker)
        })
    })
  }, [])
  async function fetchDeals(role?: string, broker?: string | null) {
    let query = browser.from('deals').select('*, clients(first_name, last_name), credit_officers(name), lenders(name)').order('created_at', { ascending: false })
    if (role === 'broker' && broker) {
      query = query.ilike('assigned_broker', broker)
    }
    // STAFF SEE THE WHOLE BOOK.
    //
    // Staff used to see only the deals they were the credit officer on, so
    // Kylie could not see Mark's files at all. Fabio, 9 Sep 2026: "the staff
    // can see all broker deals." A broker still sees only their own - that one
    // is deliberate.
    const { data, error } = await query
    if (!error && data) setDeals(data)
    setLoading(false)
  }
  async function cloneDeal(e: React.MouseEvent, deal: any) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Clone "${deal.deal_name}"? This copies Fact Find only — BC, LO, and Compliance start fresh.`)) return

    const { data: fullDeal } = await browser.from('deals').select('fact_find_data, client_id, deal_type, assigned_broker').eq('id', deal.id).single()
    if (!fullDeal) { alert('Could not load deal to clone'); return }

    // A clone is marked as one and keeps the original's name otherwise, so the two
    // sit next to each other on the board and it is obvious which is which.
    const newDealName = `${deal.deal_name}_clone`

    const { data: inserted, error } = await browser.from('deals').insert([{
      deal_name: newDealName,
      client_id: fullDeal.client_id,
      deal_type: fullDeal.deal_type,
      assigned_broker: fullDeal.assigned_broker,
      // A NEW DEAL IS NOT A BC. This column is legacy - phaseOf works out where a
      // deal really is from what has actually been done to it - but it is still
      // written here, and it was being born as 'BC', which the dashboard printed
      // on a deal nobody had opened yet.
      stage: 'FactFind',
      status: 'in_progress',
      fact_find_data: fullDeal.fact_find_data
    }]).select().single()

    if (error || !inserted) { alert('Error cloning deal: ' + (error?.message || 'unknown error')); return }
    router.push(`/deals/${inserted.id}`)
  }

  // ASKING BEFORE DELETING.
  //
  // This used to be a one-line browser confirm. The useful thing to say is not
  // "are you sure" but "did you mean to mark it lost?" - which is what almost
  // every deletion actually is. See lib/delete-deal.ts and DeleteDealDialog.
  const [deleting, setDeleting] = useState<any>(null)
  const [deletingDocs, setDeletingDocs] = useState(0)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function askDelete(e: React.MouseEvent, deal: any) {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(deal)
    setDeletingDocs(0)
    // Counted, not guessed: the warning names how many documents go with it.
    const { count } = await browser.from('deal_documents')
      .select('id', { count: 'exact', head: true }).eq('deal_id', deal.id)
    setDeletingDocs(count || 0)
  }

  // Moving a deal back a column. The route does the writing, the history line
  // and the email to the assessor, so all three either happen or are reported -
  // see app/api/move-deal-back. Nothing is ever deleted.
  async function moveDealBack(deal: any, target: string, fields: string[], place?: boolean): Promise<string | null> {
    try {
      const res = await fetch('/api/move-deal-back', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, target, fields, place }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) return data.error || 'The move was not saved.'
      const patch: Record<string, any> = place
        ? { phase_override: target, phase_override_from: derivedPhaseOf(deal), phase_override_at: new Date().toISOString() }
        : { phase_override: null, phase_override_from: null, phase_override_at: null }
      for (const f of fields) patch[f] = null
      setDeals(prev => prev.map(d => (d.id === deal.id ? { ...d, ...patch } : d)))
      return data.warning || null
    } catch (e: any) {
      return e?.message || 'The move was not saved.'
    }
  }

  async function deleteDeal(id: string) {
    setDeleteBusy(true)
    const { data: docs } = await browser.from('deal_documents').select('id, file_path').eq('deal_id', id)
    if (docs && docs.length > 0) {
      const paths = docs.map((d: any) => d.file_path)
      await browser.storage.from('deal-documents').remove(paths)
      const { data: gone, error: docErr } = await browser.from('deal_documents')
        .delete().eq('deal_id', id).select('id')
      if (docErr || !gone || gone.length === 0) {
        setDeleteBusy(false)
        alert('The deal was NOT deleted - its document records could not be removed'
          + (docErr ? ': ' + docErr.message : '.') + ' Nothing has been changed.')
        return
      }
    }

    const { error } = await browser.from('deals').delete().eq('id', id)
    setDeleteBusy(false)
    if (error) {
      alert('Error deleting deal: ' + error.message)
      return
    }
    setDeals(prev => prev.filter(d => d.id !== id))
    setDeleting(null)
  }
  // Two toggles, because settled and lost are two different things. There used to
  // be one, and it hid `completed` while permanently showing `lost` — so three
  // dead deals sat at the bottom of the list forever and nine live post-compliance
  // ones were invisible.
  // Two ways of looking at the same deals, never two sources of truth. The board
  // is the morning "where is everything"; the list is for searching, and reads
  // better on a phone.
  // The board is what everyone opens on. Fabio, 1 Sep 2026 — it is the morning
  // "where is everything and what is stuck", and a list of twenty-one rows does
  // not answer that. The List toggle is still there for searching.
  const [layout, setLayout] = useState<'list' | 'board'>('board')
  // Remembered against this person's login, like their folded columns. See
  // lib/use-board-filters.ts and the bar that stops it ever being silent.
  const boardFilters = useBoardFilters()
  const [showSettled, setShowSettled] = useState(false)
  const [showLost, setShowLost] = useState(false)

  // THE THREE THAT LEFT THE TOOLBAR, GATHERED INTO ONE SHAPE.
  //
  // They stay three separate pieces of state because a dozen things downstream
  // read them by name; this is only how they are handed to the panel and the
  // bar, so both can count and name them without knowing where they live.
  const view: BoardView = { settled: showSettled, lost: showLost, tests: showTests }
  const toggleView = (which: ViewKey) => {
    if (which === 'settled') setShowSettled(v => !v)
    else if (which === 'lost') setShowLost(v => !v)
    else setShowTests(v => !v)
  }
  // "Clear all" has to clear ALL of it, or the button says nothing is on while
  // the board is still showing only test deals.
  const clearEverything = () => {
    boardFilters.clear()
    setShowSettled(false)
    setShowLost(false)
    setShowTests(false)
  }
  // The two filters were written out twice, once for the list and once for the
  // board, so a change to one silently did not reach the other.
  // Searching "Alexis" found three deals and "Janes" found none, on deals called
  // Alexis_Janes_Refinance_2026 - because an underscore is not a space and a
  // plain includes() cannot see past one. See lib/deal-search.ts.
  const term = search.trim()
  // Everything below this line works on `book`, never on `deals`, so the list,
  // the board, the counts and the four boxes can never disagree about whether a
  // test deal is in the book.
  const testCount = testDealsOnly(deals).length
  const book = showTests ? testDealsOnly(deals) : realDealsOnly(deals)
  const matchesSearch = (d: any) => dealMatches(d, term)
  // THE SAME FUNCTION THE TILE COUNTED WITH. Asked once, in lib/board-tiles.ts,
  // so pressing a tile can never open a screen that disagrees with the number
  // printed on it - which is exactly what the old "Compliance completed" box did.
  const matchesBox = (d: any) => tile === 'all' || matchesTile(d, tile, look.thresholds)

  // A SEARCH OVERRIDES THE TOGGLES.
  //
  // Typing a client's name is somebody looking for one particular deal. Hiding
  // it because it happens to be lost or settled is the one thing they did not
  // ask for - and the toggles are at the other end of the page, so the deal
  // simply looked deleted. Fabio, 2 Sep 2026: "lost deals not appreating on
  // search when we search".
  const filtered = book.filter(d =>
    (term || showSettled || phaseOf(d) !== 'settled') &&
    (term || showLost || phaseOf(d) !== 'lost') &&
    matchesBox(d) && matchesSearch(d))

  // The board has a Settled column of its own, so it must not be handed a list
  // with settled deals already filtered out — it would draw an empty column and
  // look broken. There is no Lost column: a dead deal is not work, and inventing
  // a column for it would put one on every screen every morning. So a search
  // that only matches lost deals says so, and offers the list instead.
  const boardDeals = book.filter(d => (showLost || phaseOf(d) !== 'lost') && matchesBox(d) && matchesSearch(d))

  // THE FILTERS, APPLIED LAST. Everything above decides what belongs on a board
  // at all; this decides what this person wants to look at today. Kept apart so
  // the bar can say "14 of 41" against the board somebody would otherwise have
  // seen, rather than against the whole book including lost deals.
  const boardShown = applyFilters(boardDeals, boardFilters.filters, look.thresholds)
  const lostMatches = term
    ? book.filter(d => phaseOf(d) === 'lost' && matchesBox(d) && matchesSearch(d))
    : []

  const totalAssigned = book.length
  // Only a broker has a list that is just theirs now. Staff see the whole book,
  // so calling it "Your deals" would be a lie.
  const isPersonalViewer = !!brokerKey
  const summaryLabel = isPersonalViewer ? 'Your deals' : 'Total deals'
  // deals is already server-filtered to just this person's deals for brokers/staff-with-officer,
  // and unfiltered (team-wide) for admin or staff without a credit officer record
  const summaryDeals = book
  // Stuck first, and oldest first inside each group. The top of the page is the
  // morning's work.
  // The same thresholds the board uses, so the two views can never disagree
  // about what is stuck.
  const grouped = [...filtered].sort((x, y) => {
    const g = GROUP_ORDER.indexOf(ageGroupOf(x, look.thresholds)) - GROUP_ORDER.indexOf(ageGroupOf(y, look.thresholds))
    if (g !== 0) return g
    return (stageAge(y, look.thresholds).days || 0) - (stageAge(x, look.thresholds).days || 0)
  })

  // The boxes count the same way the list groups, so clicking one can never open
  // an empty screen. The old "Compliance completed" box did exactly that: it
  // counted compliance-completed deals while the list excluded them, so a
  // headline of nine opened nothing.
  const live = summaryDeals.filter(d => !isFinished(d))
  const activeForStaff = live.length

  // ALL FOUR NUMBERS, WORKED OUT IN ONE PLACE. Not four sums written here
  // where nothing can test them - see lib/board-tiles.ts and its tests, which
  // prove the chase count is exactly the deals the board paints red.
  const counts = tileCounts(summaryDeals, look.thresholds)

  // The number each tile shows, and the quiet line underneath it.
  const TILE_COUNT: Record<TileKey, number> = {
    chase: counts.chase, review: counts.review, waiting: counts.waiting, all: counts.all,
  }
  const TILE_NOTE: Record<TileKey, string> = {
    chase: '', review: reviewSplit(counts), waiting: '',
    all: closedLine(summaryDeals.length, live.length),
  }
  // AND THE SAME TINT ON THE CARD ITSELF - one-card-marking.html, the option
  // Fabio marked SHIP THIS: "the stripe is gone, colour all the way round".
  // These are the tile skins below with a hover on them, deliberately, so a
  // card and the tile that counts it are never two different colours.
  const CARD_SKIN: Record<'chase' | 'review' | 'waiting' | 'none', string> = {
    chase:   'bg-card-chase border-card-chase-edge hover:border-chase',
    review:  'bg-info-bg border-info-edge hover:border-info',
    waiting: 'bg-card-waiting border-card-waiting-edge hover:border-waiting',
    none:    'bg-card border-gray-100 hover:border-brand',
  }
  // The tint each one wears. Grey for the total, because a total is not a state.
  const TILE_SKIN: Record<TileKey, string> = {
    chase:   'bg-card-chase border-card-chase-edge',
    review:  'bg-info-bg border-info-edge',
    waiting: 'bg-card-waiting border-card-waiting-edge',
    all:     'bg-card border-line',
  }
  const TILE_DOT: Record<TileKey, string> = {
    chase: 'bg-chase', review: 'bg-info', waiting: 'bg-waiting', all: 'bg-faint',
  }
  const TILE_INK: Record<TileKey, string> = {
    chase: 'text-chase', review: 'text-info', waiting: 'text-waiting', all: 'text-ink',
  }
  return (
    <div className="p-6">
      {/* FOUR QUESTIONS, FOUR PRESSES. What is on fire, what is waiting for me,
          what is out of my hands, and how much is there altogether.

          AND THEY TEACH THE COLOURS WITHOUT A WORD OF EXPLANATION. Somebody new
          reads "Needs you today" beside a red square, then sees red cards on the
          board, and has learnt what red means without anybody telling them.

          Pressing the one already on turns it off, so a tile can never leave
          somebody on a filtered board wondering where the deals went. */}
      {!loading && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {TILE_KEYS.map(k => {
            const on = tile === k
            return (
              <button key={k} onClick={() => setTile(on ? 'all' : k)}
                aria-pressed={on}
                className={`text-left border rounded-xl px-3.5 py-3 transition flex items-center gap-2.5 ${TILE_SKIN[k]} ${
                  on ? 'ring-2 ring-brand ring-inset' : 'hover:brightness-[.985]'}`}>
                <span className={`w-2.5 h-2.5 rounded-[3px] flex-none ${TILE_DOT[k]}`} />
                <span className="min-w-0">
                  <span className="block text-[11px] text-muted truncate">
                    {k === 'all' ? summaryLabel : TILE_LABEL[k]}
                  </span>
                  <span className={`block text-[21px] font-semibold leading-[1.15] tracking-[-.02em] ${TILE_INK[k]}`}>
                    {TILE_COUNT[k]}
                  </span>
                </span>
                {TILE_NOTE[k] && (
                  <span className="ml-auto text-[10px] text-faint whitespace-nowrap self-center">
                    {TILE_NOTE[k]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
      {userRole === 'staff' && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-card border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Deals assigned to you</div>
            <div className="text-2xl font-semibold text-ink">{totalAssigned}</div>
          </div>
          <div className="flex-1 bg-info-bg border border-info-edge rounded-xl p-4">
            <div className="text-xs text-brand mb-1">Active (not yet complete)</div>
            <div className="text-2xl font-semibold text-brand">{activeForStaff}</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-0.5 border border-gray-200 rounded-lg overflow-hidden bg-card flex-none">
          {([['list', 'List'], ['board', 'Board']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setLayout(k)}
              className={`text-sm px-3 py-2 ${layout === k ? 'bg-brand text-on-brand font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name, client, purpose..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-card focus:outline-none focus:border-brand" />
        </div>
        {/* ONE BUTTON. Fabio, 30 Sep 2026: "dont want all filters sitting open
            can we do drop drown selection?" - so broker, credit officer, lender
            and needs-attention all live behind this.

            AND SINCE 2 OCT, SO DO SETTLED, LOST AND TEST DEALS. They were three
            more buttons in this row, which made the row the busiest thing on the
            page. They are counted on the button and named on the bar across the
            top of the board, so moving them out of sight has not made any of
            them quiet - see lib/board-filters.ts.

            The broker, officer and lender filters are the BOARD'S - the list has
            its own columns and sorting, and two ways to narrow one screen is one
            too many. But settled, lost and test deals belong to both, so the
            list gets the same button carrying only those three and saying
            "Showing" rather than "Filters". */}
        {(
          <BoardFilters deals={boardDeals} filters={boardFilters.filters}
            thresholds={look.thresholds} nameFor={nameFor}
            colours={{ broker: look.broker }}
            onToggle={boardFilters.toggle} onToggleNudge={boardFilters.toggleNudge}
            onClear={clearEverything}
            view={view} onToggleView={toggleView} testCount={testCount}
            scope={layout === 'board' ? 'board' : 'list'} />
        )}
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-brand text-on-brand text-sm font-semibold rounded-lg hover:brightness-[1.04]">
          <Plus size={14} />New deal
        </button>
      </div>
      {showTests && (
        <div className="mb-3 border border-waiting-edge bg-waiting-bg rounded-lg px-3.5 py-2.5 text-[12.5px] text-waiting">
          Showing test deals only. None of these is counted anywhere, none can email a client,
          and none records a lender rate.
        </div>
      )}
      {/* The board has no Lost column, so a search that finds only dead deals
          would otherwise look like it found nothing at all. */}
      {layout === 'board' && lostMatches.length > 0 && (
        <div className="mb-3 border border-line bg-gray-50 rounded-lg px-3.5 py-2.5 text-[12.5px] text-muted flex items-center gap-2.5 flex-wrap">
          <span>
            {lostMatches.length} lost {lostMatches.length === 1 ? 'deal matches' : 'deals match'}
            {' '}&ldquo;{search.trim()}&rdquo;. The board has no column for a lost deal.
          </span>
          <button onClick={() => { setLayout('list'); setShowLost(true) }}
            className="ml-auto text-[12.5px] font-semibold text-brand-ink border border-info-edge bg-card rounded-md px-2.5 py-1 hover:bg-info-bg">
            See {lostMatches.length === 1 ? 'it' : 'them'} in the list
          </button>
        </div>
      )}
      {deleting && (
        <DeleteDealDialog
          deal={deleting}
          documentCount={deletingDocs}
          busy={deleteBusy}
          onMarkLost={() => router.push(`/deals/${deleting.id}?close=1`)}
          onDelete={() => deleteDeal(deleting.id)}
          onCancel={() => { if (!deleteBusy) setDeleting(null) }} />
      )}
      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading deals...</div>
      ) : layout === 'board' ? (
        <>
          {/* ACROSS THE TOP OF THE BOARD, not beside the button. A filter is a
              way to hide deals and this board exists because nine of them once
              sat hidden - so what is on is said where it cannot be missed, and
              dropped without opening anything. */}
          <BoardFilterBar filters={boardFilters.filters}
            shown={boardShown.length} total={boardDeals.length} nameFor={nameFor}
            onToggle={boardFilters.toggle} onToggleNudge={boardFilters.toggleNudge}
            onClear={clearEverything}
            view={view} onToggleView={toggleView} />
          <DealBoard deals={boardShown} allDeals={boardDeals} showLost={showLost} nameFor={nameFor}
            onDelete={askDelete} onMoveBack={moveDealBack}
            colours={{ type: look.type, use: look.use, broker: look.broker }}
            thresholds={look.thresholds} alerts={alerts} />
        </>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase size={32} className="text-gray-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-gray-500 mb-1">No deals yet</div>
          <div className="text-xs text-gray-400">Click "New deal" to create your first one</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {grouped.map((deal, gi) => {
            const readyStage = readyStageFor(deal)
            const grp = ageGroupOf(deal, look.thresholds)
            const age = stageAge(deal, look.thresholds)
            const showHeader = gi === 0 || ageGroupOf(grouped[gi - 1], look.thresholds) !== grp
            return (
            <Fragment key={deal.id}>
            {showHeader && (
              <div className={`flex items-center gap-2.5 px-1 mb-0.5 ${gi === 0 ? '' : 'mt-4'}`}>
                <span className={`text-[11px] font-bold tracking-[.08em] uppercase ${GROUP_STYLE[grp].text}`}>
                  {GROUP_STYLE[grp].label}
                </span>
                <span className="text-[11px] text-faint">
                  {grouped.filter(d => ageGroupOf(d) === grp).length}
                </span>
                <span className="flex-1 h-px bg-line" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Link href={readyStage ? `/deals/${deal.id}?stage=${readyStage}` : `/deals/${deal.id}`} className={`flex-1 border rounded-xl px-4 py-3 flex items-center gap-4 transition-all ${CARD_SKIN[cardTone(deal, look.thresholds) || 'none']}`}>
                <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {deal.clients?.first_name?.[0]}{deal.clients?.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2 min-w-0">
                    <DealName className="truncate" name={deal.deal_name}
                      others={(twins.get(deal.id) || []).map(o => String(o.deal_name || ''))} />
                    {(twins.get(deal.id) || []).length > 0 && (
                      <span className="text-[10px] font-bold tracking-[.05em] uppercase text-muted bg-gray-50 border border-line rounded px-1.5 py-px flex-shrink-0">
                        {(twins.get(deal.id) || []).length + 1} deals
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {deal.clients?.first_name} {deal.clients?.last_name}
                    {deal.deal_type && <> · {deal.deal_type}</>}
                    {deal.assigned_broker && <> · {nameFor(deal.assigned_broker)}</>}
                    {(deal as any).credit_officers?.name && <> · Credit: {(deal as any).credit_officers.name}</>}
                  </div>
                </div>
                {(() => {
                  const waitingOn = getWaitingOnLabel(deal, (deal as any).credit_officers?.name)
                  return waitingOn ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${WAITING_ON_STYLES[waitingOn.color]}`}>{waitingOn.text}</span>
                  ) : null
                })()}
                {readyStage && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-waiting-bg text-waiting border border-waiting-edge">{readyStage} ready for review</span>
                )}
                {grp !== 'settled' && grp !== 'lost' && age.days !== null && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${GROUP_STYLE[grp].chip}`}
                        title={`In this stage for ${age.label} (business days)`}>{age.label}</span>
                )}
                {/* This printed deals.stage — the column that only ever moved when a
                    client clicked proceed, so it lied on most deals. It says which
                    phase the deal is actually in now. */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                  isFinished(deal) ? 'bg-gray-100 text-gray-500' : 'bg-brand/10 text-brand'}`}>
                  {PHASE_LABEL[phaseOf(deal)]}
                </span>
              </Link>
              <button onClick={e => cloneDeal(e, deal)}
                className="w-8 h-8 rounded-full border border-gray-200 bg-card flex items-center justify-center text-gray-300 hover:text-brand hover:border-info-edge hover:bg-info-bg flex-shrink-0 transition">
                <Copy size={13} />
              </button>
              <button onClick={e => askDelete(e, deal)}
                className="w-8 h-8 rounded-full border border-gray-200 bg-card flex items-center justify-center text-gray-300 hover:text-chase hover:border-chase-edge hover:bg-chase-bg flex-shrink-0 transition">
                <Trash2 size={13} />
              </button>
            </div>
            </Fragment>
          )})}
        </div>
      )}
      {showModal && <NewDealModal onClose={() => setShowModal(false)} onCreated={(id) => { setShowModal(false); router.push(`/deals/${id}?stage=FactFind`) }} brokerKey={brokerKey} userRole={userRole} />}
    </div>
  )
}

function makeUid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}
function makeApplicant(first_name: string, last_name: string, email: string, phone: string, clientId?: string) {
  const id = makeUid()
  return {
    id, title: '', firstName: first_name, middleName: '', lastName: last_name,
    preferredName: '', previousName: '', gender: '', dob: '',
    phoneMobile: phone, emailPersonal: email, clientId,
    addresses: [{ id: makeUid(), address: '', residentialStatus: '', isCurrent: true, startDate: '' }],
    employment: [{ id: makeUid(), isCurrent: true, employmentPriority: 'Primary', employmentBasis: 'Full time', occupation: '', startDate: '', onProbation: false, employerName: '', employerAbn: '', employerAcn: '', employerType: '', employerAddress: '', contactPersonName: '', contactPersonDetails: '' }],
    income: [{ id: makeUid(), incomeType: 'PAYG', employmentId: '', grossSalary: '', grossSalaryFrequency: 'Annually', bonusAmount: '', bonusFrequency: 'Annually', overtimeEssentialAmount: '', overtimeEssentialFrequency: 'Annually', overtimeNonEssentialAmount: '', overtimeNonEssentialFrequency: 'Annually', commissionAmount: '', commissionFrequency: 'Annually', allowanceAmount: '', allowanceFrequency: 'Annually' }]
  }
}

function NewDealModal({ onClose, onCreated, brokerKey, userRole }: { onClose: () => void; onCreated: (id: string) => void; brokerKey: string | null; userRole: string }) {
  const browser = createSupabaseBrowser()
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [showSecondApplicant, setShowSecondApplicant] = useState(false)
  const [form2, setForm2] = useState({ first_name: '', last_name: '', email: '', phone: '', client_id: '' })
  // No fallback to a named person. An unassigned deal is visible and fixable;
  // one quietly filed under the wrong broker is neither.
  const [deal, setDeal] = useState({ assigned_broker: brokerKey || '', lead_source: '' })
  // Off by default, so nothing changes for a normal deal. It sits with the
  // names where you cannot miss it, not behind a settings screen.
  const [isTest, setIsTest] = useState(false)
  const [createError, setCreateError] = useState('')
  const [saving, setSaving] = useState(false)
  const { options: brokerList } = useBrokerNames()

  useEffect(() => {
    browser.from('clients').select('*').order('first_name').then(({ data }) => { if (data) setClients(data) })
  }, [])

  // WHAT THESE PEOPLE ALREADY TOLD US, SAID BEFORE THE DEAL IS MADE.
  //
  // The fact find is about to start with their properties, liabilities and
  // assets on it. That should never be a surprise found later - it is said here,
  // in words, while there is still a Cancel button. See lib/seed-from-client.ts.
  const [carrying, setCarrying] = useState('')
  const clientIdsPicked = [selectedClient?.id, form2.client_id].filter(Boolean).join(',')

  useEffect(() => {
    const ids = clientIdsPicked ? clientIdsPicked.split(',') : []
    if (ids.length === 0) { setCarrying(''); return }
    let alive = true
    browser.from('clients')
      .select('id, position_properties, position_liabilities, position_assets')
      .in('id', ids)
      .then(({ data }) => {
        if (!alive) return
        const byId = new Map((data || []).map((r: any) => [r.id, r]))
        const stand = ids.map((id, i) => ({ id: `a${i}`, clientId: id }))
        const seeded = seedFromClients(stand, (clientId) => {
          const r: any = byId.get(clientId)
          if (!r) return null
          return { properties: r.position_properties, liabilities: r.position_liabilities, assets: r.position_assets }
        }, () => 'preview')
        setCarrying(seedSummary(seeded))
      })
    return () => { alive = false }
  }, [clientIdsPicked])

  const app1First = selectedClient?.first_name || form.first_name || ''
  const app1Last = selectedClient?.last_name || form.last_name || ''
  const app2First = form2.first_name || ''
  const app2Last = form2.last_name || ''
  // Deals used to be saved as ClientName_Purpose_Year. On a board the underscores
  // do not wrap so the name ran out of the card, and the purpose is already shown
  // as a chip beside it. Fabio, 2 Sep 2026: "First Name Last Name & First Name
  // Last Name Year Created".
  //
  // Two deals for the same client in the same year now collide, and that is fine —
  // the SalesTrekker card carries the identity for the API. Existing deals keep
  // the names they were saved with; this is the format for new ones only.
  const person = (f: string, l: string) => [f, l].map(x => String(x || '').trim()).filter(Boolean).join(' ')
  const namePart = showSecondApplicant && (app2First || app2Last)
    ? [person(app1First, app1Last), person(app2First, app2Last)].filter(Boolean).join(' & ')
    : person(app1First, app1Last)
  const dealName = `${namePart} ${new Date().getFullYear()}`.trim()

  async function handleCreate() {
    setSaving(true)
    let clientId = selectedClient?.id
    if (!clientId) {
      const { data, error: clientError } = await browser.from('clients').insert([form]).select().single()
      if (clientError || !data?.id) {
        alert('Failed to create client record. Please try again.')
        setSaving(false)
        return
      }
      clientId = data.id
    }

    // Seed fact_find_data with applicant(s) from modal
    const primaryFirstName = selectedClient?.first_name || form.first_name
    const primaryLastNameVal = selectedClient?.last_name || form.last_name
    const primaryEmail = mode === 'existing' ? '' : form.email
    const primaryPhone = mode === 'existing' ? '' : form.phone
    // EVERY APPLICANT CARRIES THE ID OF THEIR CLIENT RECORD.
    //
    // 21 Sep 2026. This used to hand over the id only when the client already
    // existed, and nothing at all when the client was new - so a deal started
    // from a NEW client got an applicant with no link to the client record that
    // had just been created three lines above, with the id sitting right there
    // in this function.
    //
    // Everything that writes a client's financial position is gated on this one
    // field: `applicants.filter(a => a.clientId)`. No link, no applicants in
    // that list, no prompt, no write, silently. So the whole assets-and-
    // liabilities capture was invisible on every deal that started with a new
    // client - which is most of them. See docs/client-link-backfill.sql for the
    // deals already in the book.
    const applicants = [makeApplicant(primaryFirstName, primaryLastNameVal, primaryEmail, primaryPhone, clientId)]
    if (showSecondApplicant && (form2.first_name || form2.last_name)) {
      // A SECOND APPLICANT IS A CLIENT TOO.
      //
      // An existing one arrives with a client_id. A new one had no client record
      // created for them at all, so they could never appear in the book, never
      // hold a position, and never be found by a search for their own name. One
      // is created for them here, the same as the first applicant gets.
      //
      // If that create fails the deal still goes ahead unlinked - losing the
      // deal over a second applicant's record would be the worse trade - and the
      // backfill picks it up later.
      let secondClientId: string | undefined = form2.client_id || undefined
      if (!secondClientId) {
        const { data: second } = await browser.from('clients').insert([{
          first_name: form2.first_name, last_name: form2.last_name,
          email: form2.email || null, phone: form2.phone || null,
        }]).select('id').single()
        secondClientId = (second as any)?.id || undefined
      }
      applicants.push(makeApplicant(form2.first_name, form2.last_name, form2.email, form2.phone, secondClientId))
    }
    // WHAT THESE PEOPLE ALREADY TOLD US.
    //
    // 25 Sep 2026. This was three empty lists for everybody, so a client whose
    // whole position we hold - captured when their last deal settled - was
    // typed out again from nothing. Fabio: "this is the point of all this".
    //
    // Read off the client record, joined up where two applicants hold the same
    // thing, and put on the new fact find as a starting point. Anybody can edit
    // it; nothing here is final. See lib/seed-from-client.ts.
    //
    // A failure is not allowed to stop a deal being created. The worst case is
    // the empty fact find this always used to give, which is what it falls back
    // to - and it says so on screen rather than quietly.
    let carried = { properties: [] as any[], liabilities: [] as any[], assets: [] as any[] }
    try {
      const ids = applicants.map(a => a.clientId).filter(Boolean) as string[]
      if (ids.length) {
        const { data: records } = await browser.from('clients')
          .select('id, position_properties, position_liabilities, position_assets')
          .in('id', ids)
        const byId = new Map((records || []).map((r: any) => [r.id, r]))
        carried = seedFromClients(applicants, (clientId) => {
          const r: any = byId.get(clientId)
          if (!r) return null
          return { properties: r.position_properties, liabilities: r.position_liabilities, assets: r.position_assets }
        }, makeUid)
      }
    } catch {
      // Falls through with the empty lists.
    }

    const fact_find_data = { applicants, ...carried }

    // Checked. This used to be a bare insert with no error handling and no
    // select, so a database refusal closed the modal and looked like success -
    // the deal simply never appeared.
    const { data: created, error } = await browser.from('deals').insert([{
      deal_name: dealName,
      client_id: clientId,
      lead_source: deal.lead_source,
      assigned_broker: deal.assigned_broker,
      // A new deal starts at the fact find. See the note on the clone above.
      stage: 'FactFind',
      status: 'in_progress',
      is_test: isTest,
      fact_find_data
    }]).select('id').single()
    setSaving(false)
    if (error) { setCreateError('NOT CREATED - ' + error.message); return }
    if (!created) { setCreateError('NOT CREATED - the database refused it.'); return }
    onCreated(created.id)
  }

  const filteredClients = clients.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase()))
  const [app2Mode, setApp2Mode] = useState<'new' | 'existing'>('new')
  const [app2Search, setApp2Search] = useState('')
  const filteredClientsApp2 = clients.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(app2Search.toLowerCase()))
  const inp = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand"
  const sel = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-6 w-[520px] max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="text-base font-semibold mb-1">New deal</div>
        <div className="text-xs text-gray-400 mb-5">Deal name format: First Last &amp; First Last Year</div>

        <div className="flex gap-2 mb-5">
          <button onClick={() => { setMode('new'); setSelectedClient(null) }} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mode==='new' ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-gray-500'}`}>New client</button>
          <button onClick={() => setMode('existing')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mode==='existing' ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-gray-500'}`}>Existing client</button>
        </div>

        {mode === 'existing' ? (
          <div className="mb-4">
            <input type="text" placeholder="Search clients..." value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              className={`${inp} mb-2`} />
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
              {filteredClients.map(c => (
                <div key={c.id} onClick={() => setSelectedClient(c)}
                  className={`px-3 py-2 rounded-lg text-sm cursor-pointer ${selectedClient?.id === c.id ? 'bg-brand/10 text-brand font-medium' : 'hover:bg-gray-50'}`}>
                  {c.first_name} {c.last_name}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Applicant 1</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone']].map(([k,l]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                  <input type="text" value={form[k as keyof typeof form]} onChange={e => setForm({...form, [k]: e.target.value})}
                    className={inp} />
                </div>
              ))}
            </div>
          </div>
        )}

        {(mode === 'existing' ? !!selectedClient : true) && (
          !showSecondApplicant ? (
            <button onClick={() => setShowSecondApplicant(true)}
              className="text-sm text-brand border border-dashed border-brand rounded-lg px-4 py-1.5 hover:bg-info-bg transition w-full mb-4">
              + Add second applicant
            </button>
          ) : (
            <div className="border border-info-edge rounded-xl p-4 bg-info-bg mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-medium text-gray-500">Applicant 2</p>
                <button onClick={() => { setShowSecondApplicant(false); setForm2({ first_name: '', last_name: '', email: '', phone: '', client_id: '' }); setApp2Mode('new'); setApp2Search('') }}
                  className="text-xs text-gray-400 hover:text-chase">Remove</button>
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setApp2Mode('new')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${app2Mode==='new' ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-gray-500'}`}>New person</button>
                <button onClick={() => setApp2Mode('existing')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${app2Mode==='existing' ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-gray-500'}`}>Existing client</button>
              </div>
              {app2Mode === 'existing' ? (
                <div>
                  <input type="text" placeholder="Search clients..." value={app2Search} onChange={e => setApp2Search(e.target.value)}
                    className={`${inp} mb-2`} />
                  <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                    {filteredClientsApp2.map(c => (
                      <div key={c.id} onClick={() => setForm2({ first_name: c.first_name, last_name: c.last_name, email: c.email || '', phone: c.phone || '', client_id: c.id })}
                        className={`px-3 py-2 rounded-lg text-sm cursor-pointer ${form2.first_name === c.first_name && form2.last_name === c.last_name ? 'bg-brand/10 text-brand font-medium' : 'hover:bg-gray-50'}`}>
                        {c.first_name} {c.last_name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone']].map(([k,l]) => (
                    <div key={k}>
                      <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                      <input type="text" value={form2[k as keyof typeof form2]} onChange={e => setForm2({...form2, [k]: e.target.value})}
                        className={inp} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* The Deal type dropdown used to live here. It was asked at the one
            moment nobody can answer it - before the fact find - and then it
            never changed again, so a deal that turned into a refinance was
            labelled a purchase forever. What kind of deal it is now comes from
            the BC template and the settlement fields, which are recorded as the
            deal actually happens. See lib/deal-labels.ts. */}
        <div className="grid grid-cols-2 gap-3 mb-4 mt-4">
          {userRole !== 'broker' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assigned broker</label>
              <select value={deal.assigned_broker} onChange={e => setDeal({...deal, assigned_broker: e.target.value})} className={sel}>
                <option value="">— select broker —</option>
                {brokerList.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Lead source</label>
            <input type="text" value={deal.lead_source} onChange={e => setDeal({...deal, lead_source: e.target.value})} placeholder="e.g. Referral, Google, Facebook..." className={inp} />
          </div>
        </div>

        <label className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 mb-4 cursor-pointer border transition ${isTest ? 'border-waiting-edge bg-waiting-bg' : 'border-gray-200 hover:bg-gray-50'}`}>
          <input type="checkbox" checked={isTest} onChange={e => setIsTest(e.target.checked)} className="mt-0.5" />
          <span>
            <span className={`text-sm font-medium ${isTest ? 'text-waiting' : 'text-gray-700'}`}>This is a test deal</span>
            <span className={`block text-xs mt-0.5 leading-relaxed ${isTest ? 'text-waiting' : 'text-gray-400'}`}>
              It will not be counted anywhere, its client emails come to you instead of the client,
              and nothing it records reaches your rate data. You can delete it in one click.
            </span>
          </span>
        </label>

        {(form.last_name || selectedClient) && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4 text-xs text-gray-500">
            Deal name: <span className="font-medium text-gray-700">{dealName}</span>
          </div>
        )}

        {carrying && (
          <div className="bg-info-bg border border-info-edge rounded-lg px-3 py-2.5 mb-4 text-xs text-brand-ink leading-relaxed">
            We already hold <span className="font-semibold">{carrying}</span> for them.
            The Fact Find will start with it, and you can change anything on it.
          </div>
        )}

        {createError && (
          <div className="bg-chase-bg border border-chase-edge text-chase rounded-lg px-3 py-2 text-xs mb-3">{createError}</div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleCreate} disabled={saving || (!selectedClient && !form.first_name) || !deal.assigned_broker}
            className="px-4 py-2 text-sm bg-brand text-on-brand rounded-lg font-medium hover:opacity-90 disabled:opacity-40">
            {saving ? 'Creating...' : 'Create deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
