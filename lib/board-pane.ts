// THE BOARD AS A PANE THAT FITS THE SCREEN.
//
// Kylie, 30 Sep 2026, via Fabio: "the collum to have their own srow capabilities
// AND we should be able to scroll sideways regardless of where we are on the
// screen".
//
// Both complaints are the same complaint. Every column used to be as tall as its
// own cards, so the busiest column set the height of the whole page - and the
// sideways scrollbar sat at the bottom of THAT. To go sideways you first had to
// scroll down past every card in the longest column, and on a real book of deals
// that is a long way. Dragging a card to a column you could not see was simply
// impossible.
//
// So the board becomes a pane the height of what is left of the screen. Each
// column scrolls its own cards inside it, keeping its name, count and total
// pinned, and the sideways bar sits at the foot of the pane where it is always
// reachable.
//
// TODAY'S BEHAVIOUR IS KEPT ON A SMALL SCREEN. Fabio, 30 Sep 2026: "keep todays
// behaviour on a small screen". A fixed-height pane inside a scrolling page is
// right on a laptop and wrong on a phone, where there is no room for two scrolls
// at once. Under WIDE_ENOUGH the board goes back to being as tall as it likes
// and the page scrolls normally - which on one column at a time is exactly what
// a person wants.

// Where a laptop stops and a phone starts. Two open columns and their gap is
// about 500px, so below this there is not enough width for the pane to be worth
// having.
export const WIDE_ENOUGH = 900

// Never smaller than this, however short the window. A pane of 200px shows one
// card and is worse than no pane at all - at that point let the page scroll.
export const MIN_PANE = 360

// Room left under the pane for the horizontal scrollbar and a breath of margin.
const FOOT = 24

// HOW TALL THE PANE SHOULD BE, from where it starts on the page.
//
// Pure, so it can be tested without a browser: hand it the window height and
// where the board begins, and it answers. Null means "do not make it a pane" -
// either the window is too narrow, or what is left is too short to be useful.
export function paneHeight(opts: {
  windowWidth: number
  windowHeight: number
  // Distance from the top of the viewport to the top of the board.
  boardTop: number
}): number | null {
  if (!Number.isFinite(opts.windowWidth) || opts.windowWidth < WIDE_ENOUGH) return null
  const left = opts.windowHeight - opts.boardTop - FOOT
  // A short window on a wide screen is the awkward case. Rather than squeezing
  // the pane to nothing, hand back the minimum and let it overflow a little -
  // the sideways bar is still on screen, which is the whole point.
  return Math.max(MIN_PANE, Math.round(left))
}

// SCROLLING SIDEWAYS WHILE DRAGGING A CARD.
//
// You cannot drop a deal into a column you cannot see, and until now there was
// no way to bring one into view mid-drag. Dragging within EDGE of either end of
// the pane nudges it along.
//
// Pure for the same reason: given where the pointer is and where the pane is,
// how far should it move this frame.
export const EDGE = 64
const STEP = 18

export function dragScrollBy(opts: {
  pointerX: number
  paneLeft: number
  paneRight: number
}): number {
  const { pointerX, paneLeft, paneRight } = opts
  if (!(paneRight > paneLeft)) return 0
  if (pointerX < paneLeft || pointerX > paneRight) return 0
  const fromLeft = pointerX - paneLeft
  const fromRight = paneRight - pointerX
  // Nearer the edge, faster - so a small nudge browses and a hard push travels.
  if (fromLeft < EDGE) return -Math.round(STEP * (1 - fromLeft / EDGE)) || -1
  if (fromRight < EDGE) return Math.round(STEP * (1 - fromRight / EDGE)) || 1
  return 0
}
