import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { cardTone, matchesTile } from './board-tiles'

// A CARD AND THE TILE THAT COUNTS IT ARE THE SAME COLOUR.
//
// 6 Oct 2026, docs/approved-looks/one-card-marking.html. Before this, a deal
// ready for review was outlined purple on the board while the tile counting it
// was blue - the board disagreeing with itself in front of the team every
// morning. Both read the same three questions now, and these tests fail if
// anybody ever answers them twice.
const live = (extra: any = {}) => ({ status: 'active', ...extra })

describe('the colour on a card is the colour of its tile', () => {
  it('a dead deal is not marked at all', () => {
    expect(cardTone({ status: 'completed' })).toBe(null)
    expect(cardTone({ status: 'lost' })).toBe(null)
  })

  it('whatever tone a card has, that tile counts it', () => {
    // Built rather than imagined: every deal shape the board can produce.
    const shapes = [
      live(),
      live({ bc_ready_for_review: true }),
      live({ lo_ready_for_review: true }),
      live({ waiting_on: 'lender' }),
      live({ bc_ready_for_review: true, waiting_on: 'lender' }),
    ]
    for (const d of shapes) {
      const tone = cardTone(d)
      if (tone === null) continue
      expect(matchesTile(d, tone),
        `a card marked "${tone}" is not counted by the "${tone}" tile`).toBe(true)
    }
  })

  it('and the page paints from that answer, not from its own', () => {
    const page = readFileSync('app/(app)/deals/page.tsx', 'utf8')
    expect(page).toContain('cardTone(deal, look.thresholds)')
    expect(page).toContain('CARD_SKIN')
    // The old marking - an outline on one state only - must be gone.
    expect(page, 'the card is still being outlined instead of filled')
      .not.toContain("readyStage ? 'border-waiting-edge hover:border-waiting'")
  })

  it('the fill is a wash, not a border - that was the whole decision', () => {
    const page = readFileSync('app/(app)/deals/page.tsx', 'utf8')
    for (const want of ['bg-card-chase', 'bg-info-bg', 'bg-card-waiting']) {
      expect(page, `${want} is missing, so that state has no colour on the card`).toContain(want)
    }
  })
})
