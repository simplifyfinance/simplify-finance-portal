import { describe, it, expect } from 'vitest'
import {
  TILE_KEYS, TILE_LABEL, WAITING_PHASES, closedLine, isLive, matchesTile,
  needsChasing, readyForReview, readyStageFor, reviewSplit, tileCounts,
} from './board-tiles'
import { ageGroupOf } from './deal-age'
import { readFileSync } from 'fs'
import { chipStyle } from './deal-labels'
import { phaseOf } from './deal-phase'
import { isUrgentNow } from './push-answers'
import { needsAttention } from './board-filters'

// THE TILE AND THE CARDS UNDER IT MUST AGREE.
//
// 2 Oct 2026. The old "Compliance completed" box counted one way while the list
// it opened counted another, so a headline of nine opened an empty screen. That
// is the whole reason this file is a file: the rule is written once, and these
// tests prove nothing has quietly started asking it a second way.

// Phases come from timestamps, so a fixture is just the timestamps. Dates are
// after AGEING_FROM (24 Aug 2026), or nothing ages at all.
const OLD = '2026-09-01T09:00:00Z'     // weeks back - past every nudge threshold
const TODAY = new Date().toISOString()

const atPhase = (fields: Record<string, any>) => ({ ...fields })

const factFindOld   = atPhase({ created_at: OLD, fact_find_data: { applicants: [{ dob: '1980-01-01' }] }, _n: 'ff' })
const sentOld       = atPhase({ compliance_sent_at: OLD })
const sentToday     = atPhase({ compliance_sent_at: TODAY })
const lodgedToday   = atPhase({ lodged_at: TODAY })
const outstanding   = atPhase({ outstanding_at: TODAY })
const preapproved   = atPhase({ preapproval_at: TODAY })
const bcReady       = atPhase({ created_at: TODAY, bc_completed_at: TODAY })
const loReady       = atPhase({ created_at: TODAY, bc_completed_at: TODAY, lo_completed_at: TODAY })
const compliant     = atPhase({ created_at: TODAY, bc_completed_at: TODAY, lo_completed_at: TODAY, compliance_completed_at: TODAY })

// FLAGGED URGENT BY HAND, BUT NOT OLD. This one exists because the test below
// passed without it: the board has a SECOND red idea - somebody ticking urgent -
// and a version of needsChasing that quietly folded it in went undetected,
// because no fixture here had the flag set. A differential test is only as wide
// as the cases you hand it.
const urgentFresh   = atPhase({ compliance_sent_at: TODAY, is_urgent: true })

describe('the four tiles exist and are named', () => {
  it('is four, in the order they are read', () => {
    expect(TILE_KEYS).toEqual(['chase', 'review', 'waiting', 'all'])
  })

  it('and every one has a label', () => {
    for (const k of TILE_KEYS) expect(TILE_LABEL[k]).toBeTruthy()
  })

  it('says nothing about amber, which is the point', () => {
    expect(JSON.stringify(TILE_LABEL).toLowerCase()).not.toContain('amber')
  })
})

describe('"Needs you today" is the same question the card asks', () => {
  // THE TEST THAT MATTERS MOST. If this ever drifts, the tile says six and the
  // board shows five red cards, and nobody can tell which is lying.
  it('counts exactly the deals the board paints red, and nothing else', () => {
    const deals = [factFindOld, sentOld, sentToday, lodgedToday, outstanding, preapproved, bcReady, loReady, urgentFresh]
    for (const d of deals) {
      expect(needsChasing(d), `${phaseOf(d)}`).toBe(ageGroupOf(d) === 'nudge')
    }
  })

  it('does catch something, so the test above is not passing on an empty set', () => {
    expect(needsChasing(sentOld)).toBe(true)
    expect(needsChasing(sentToday)).toBe(false)
  })

  it('a deal that has only just moved is never chased', () => {
    for (const d of [sentToday, lodgedToday, outstanding, preapproved]) {
      expect(needsChasing(d)).toBe(false)
    }
  })

  // THE BOARD HAS A SECOND RED IDEA, AND THIS TILE IS NOT IT.
  //
  // Somebody can tick a deal urgent by hand, and lib/board-filters.ts folds that
  // into "needs attention" for the filter. Fabio chose the narrower rule for the
  // tile: past the day threshold, full stop. Without this case a version that
  // quietly added the urgent flag passed every test in this file.
  it('is the day threshold and nothing else, not the urgent tick', () => {
    expect(isUrgentNow(urgentFresh)).toBe(true)
    expect(ageGroupOf(urgentFresh)).not.toBe('nudge')
    expect(needsChasing(urgentFresh)).toBe(false)
  })

  it('and needsAttention is a DIFFERENT, wider question - they must not be the same', () => {
    // If these two ever agree on every case, one of them has been made to call
    // the other and the tile has silently widened.
    expect(needsAttention(urgentFresh)).toBe(true)
    expect(needsChasing(urgentFresh)).toBe(false)
  })
})

describe('"Ready for your review" is the two old tiles, unchanged', () => {
  // The old page worked these out inline. They are restated here as they were
  // written, so this proves the maths MOVED rather than changed.
  const wasBcReady = (d: any) => !!(d.bc_completed_at && !d.lo_completed_at && !d.compliance_completed_at)
  const wasLoReady = (d: any) => !!(d.lo_completed_at && !d.compliance_completed_at)

  const deals = [factFindOld, sentOld, bcReady, loReady, compliant, outstanding]

  it('splits BC and LO exactly as the old boxes did', () => {
    for (const d of deals) {
      expect(readyStageFor(d) === 'BC', JSON.stringify(d)).toBe(wasBcReady(d))
      expect(readyStageFor(d) === 'LO', JSON.stringify(d)).toBe(wasLoReady(d))
    }
  })

  it('and the joined number is just the two added up', () => {
    const c = tileCounts(deals)
    expect(c.bc).toBe(deals.filter(wasBcReady).length)
    expect(c.lo).toBe(deals.filter(wasLoReady).length)
    expect(c.review).toBe(c.bc + c.lo)
  })

  it('a deal cannot be ready at both stages at once', () => {
    for (const d of deals) {
      expect(!(wasBcReady(d) && wasLoReady(d))).toBe(true)
    }
  })

  it('and once compliance is done it is ready for nobody', () => {
    expect(readyForReview(compliant)).toBe(false)
  })

  it('shows the split beside the number, and nothing when there is none', () => {
    expect(reviewSplit({ chase: 0, review: 20, bc: 17, lo: 3, waiting: 0, all: 0 })).toBe('BC 17 · LO 3')
    expect(reviewSplit({ chase: 0, review: 0, bc: 0, lo: 0, waiting: 0, all: 0 })).toBe('')
  })
})

describe('"Waiting on someone" means the ball is out of this office', () => {
  it('counts the stages where somebody else is holding the file', () => {
    expect([...WAITING_PHASES].sort()).toEqual([
      'compliance_sent', 'contracts_returned', 'formal', 'lodged',
      'offer_accepted', 'settlement_booked',
    ])
  })

  // THE TWO THAT LOOK LIKE WAITING AND ARE NOT. Both are the client, and a
  // client who has gone quiet is yours to chase - which is red, or nothing.
  it('is not the client house-hunting, and not outstanding conditions', () => {
    expect(phaseOf(preapproved)).toBe('preapproved')
    expect(phaseOf(outstanding)).toBe('outstanding')
    expect(WAITING_PHASES).not.toContain('preapproved')
    expect(WAITING_PHASES).not.toContain('outstanding')
    expect(matchesTile(preapproved, 'waiting')).toBe(false)
    expect(matchesTile(outstanding, 'waiting')).toBe(false)
  })

  it('and never a stage that is still sitting on our own desk', () => {
    for (const ours of ['fact_find', 'bc', 'lo', 'compliance']) {
      expect(WAITING_PHASES, `${ours} is our own work`).not.toContain(ours)
    }
  })

  it('does catch the ones it should', () => {
    expect(matchesTile(sentToday, 'waiting')).toBe(true)
    expect(matchesTile(lodgedToday, 'waiting')).toBe(true)
  })
})

describe('every tile counts live deals and only live deals', () => {
  const settled = atPhase({ settled_at: TODAY })
  const lost = atPhase({ lost_at: TODAY, status: 'lost' })

  it('a finished deal is in no tile at all', () => {
    for (const d of [settled, lost]) {
      for (const k of TILE_KEYS) {
        expect(matchesTile(d, k), `${k} counted a finished deal`).toBe(false)
      }
    }
  })

  it('"All live deals" is exactly the live ones', () => {
    const deals = [factFindOld, sentOld, settled, lost, bcReady]
    expect(tileCounts(deals).all).toBe(deals.filter(isLive).length)
    expect(tileCounts(deals).all).toBe(3)
  })

  // A tile that counted more than the board holds would send somebody looking
  // for deals that are not there.
  it('and no tile can ever be bigger than that', () => {
    const deals = [factFindOld, sentOld, sentToday, lodgedToday, outstanding, preapproved, bcReady, loReady, settled]
    const c = tileCounts(deals)
    for (const n of [c.chase, c.review, c.waiting]) expect(n).toBeLessThanOrEqual(c.all)
  })

  it('counts and pressing the tile agree, tile by tile', () => {
    const deals = [factFindOld, sentOld, sentToday, lodgedToday, outstanding, preapproved, bcReady, loReady, settled, lost]
    const c = tileCounts(deals)
    expect(deals.filter(d => matchesTile(d, 'chase')).length).toBe(c.chase)
    expect(deals.filter(d => matchesTile(d, 'review')).length).toBe(c.review)
    expect(deals.filter(d => matchesTile(d, 'waiting')).length).toBe(c.waiting)
    expect(deals.filter(d => matchesTile(d, 'all')).length).toBe(c.all)
  })

  it('survives an empty book and a book of nonsense', () => {
    expect(tileCounts([])).toEqual({ chase: 0, review: 0, bc: 0, lo: 0, waiting: 0, all: 0 })
    expect(() => tileCounts([{}, { bc_completed_at: null }])).not.toThrow()
  })
})

describe('the line under the total says what is not in it', () => {
  it('names the closed ones rather than losing them', () => {
    expect(closedLine(71, 50)).toBe('21 settled or lost')
    expect(closedLine(50, 50)).toBe('none closed')
  })
})

// --- and the card, which is the whole point ----------------------------------
//
// The rules above are only worth having if the board actually asks them. These
// read components/DealBoard.tsx, because a rule the card re-implements its own
// way is exactly how a tile of six ends up over five red cards.

describe('the card wears the colour of the tile that counts it', () => {
  const board = readFileSync('components/DealBoard.tsx', 'utf8')

  it('asks these functions rather than working it out again', () => {
    expect(board).toContain("from '@/lib/board-tiles'")
    expect(board).toContain('needsChasing(d, thresholds)')
    expect(board).toContain('waitingOnSomeone(d)')
  })

  // A deal sitting with a lender that has ALSO gone past its threshold is a deal
  // to chase. If purple won, the only cards that could ever be red would be the
  // ones on our own desk - and the whole right-hand side of the board would go
  // quiet exactly when it should not.
  it('lets red beat purple, so a late deal cannot hide behind "not ours"', () => {
    expect(board).toContain('const waiting = !chasing && waitingOnSomeone(d)')
  })

  it('tints the whole card, never a stripe down one side', () => {
    expect(board).toContain('bg-card-chase border-card-chase-edge')
    expect(board).toContain('bg-card-waiting border-card-waiting-edge')
    // A stripe is what damage looks like. If one of these ever appears on a
    // card, somebody has gone back to the thing Fabio rejected on sight.
    expect(board).not.toMatch(/border-l-[24] /)
  })

  it('and spells no colour out by hand any more', () => {
    expect(board.replace(/\/\/.*$/gm, '')).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})

describe('the word is "chase", everywhere a person can read it', () => {
  const screens = ['components/DealBoard.tsx', 'app/(app)/deals/page.tsx']

  it('says what it means on the card and in the column head', () => {
    const board = readFileSync('components/DealBoard.tsx', 'utf8')
    expect(board).toContain('to chase')
    expect(board).not.toContain('a nudge')
    expect(board).not.toContain('\\u00b7 nudge')
  })

  // "nudge" survives as the NAME of a threshold in the data and in the filter
  // that has always been called "needs attention" - renaming those is a separate
  // job with a migration in it. What must not survive is the word reaching a
  // screen, where it has to match what the tiles and the chips say.
  it('and nothing on these two screens shows the old word to anybody', () => {
    const showing: string[] = []
    for (const f of screens) {
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      // Anything inside a JSX text run or a quoted label.
      for (const m of src.matchAll(/>[^<>{}]*\bnudge\b[^<>{}]*</gi)) showing.push(`${f}: ${m[0].trim()}`)
      for (const m of src.matchAll(/(['"`])[^'"`\n]*\bneeds? a nudge\b[^'"`\n]*\1/gi)) showing.push(`${f}: ${m[0]}`)
    }
    expect(showing, showing.join('\n')).toEqual([])
  })
})

describe('a chip on a washed card does not sink into it', () => {
  it('takes the card colour rather than its own tint', () => {
    expect(chipStyle('#107EA8', true).background).toBe('var(--color-card)')
    expect(chipStyle('#107EA8', false).background).toBe('#107EA814')
    // The lettering and the edge are the chip's own either way, or it stops
    // being a chip and becomes a word.
    expect(chipStyle('#107EA8', true).color).toBe('#107EA8')
    expect(chipStyle('#107EA8', true).borderColor).toBe('#107EA838')
  })

  it('and the board actually passes that flag', () => {
    expect(readFileSync('components/DealBoard.tsx', 'utf8')).toContain('chipStyle(c.colour, washed)')
  })
})
