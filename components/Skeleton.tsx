'use client'

// THE PAGE DRAWS ITS OWN SHAPE WHILE THE FIGURES ARE ON THEIR WAY.
//
// 7 Oct 2026, picked alongside the bar. Every screen in here used to answer
// "am I loading" with one line of small grey type on an empty page, and then
// the whole layout appeared at once underneath it, pushing nothing because
// there was nothing there yet.
//
// A skeleton does two things that line never did. It says the page is coming
// AND roughly what it will be, in the place it will be - so there is something
// to look at while you wait. And because the shape is already on screen at the
// right size, nothing jumps when the real content replaces it.
//
// THE RULE FOR USING THESE: draw the shape the page ACTUALLY HAS. A skeleton
// that shows three panels where the page has two is worse than no skeleton,
// because it moves everything the moment it is replaced - which is the exact
// fault it exists to prevent. Each pane writes its own, from its own layout.
//
// They are deliberately plain. No shimmer sweeping across, which is a second
// moving thing competing with the bar at the top for the same half-second.
// These breathe slowly in place; the bar is the thing that moves.

// bg-line is the portal's own rule colour, and it already has a value in both
// themes - #E8E2D8 on the cream page, #383E46 on the dark one. A new
// --color-skeleton would have to be added to lib/colours.ts as well, and a
// third grey nobody can tell from the second is not worth a palette entry.
const BLOCK = 'bg-line rounded-md animate-[breathe_1.5s_ease-in-out_infinite]'

// One grey line. `w` is a Tailwind width class so a caller can match the line
// it stands in for - a heading is not as wide as a paragraph.
export function SkelLine({ w = 'w-full', tall = false }: { w?: string; tall?: boolean }) {
  return <div className={`${BLOCK} ${w} ${tall ? 'h-4' : 'h-3'}`} />
}

// A figure in a count tile: the big number, then its label.
export function SkelTile() {
  return (
    <div className="bg-card border border-card-line rounded-xl px-3.5 py-2.5">
      <div className={`${BLOCK} h-6 w-10`} />
      <div className="h-2.5" />
      <div className={`${BLOCK} h-3 w-20`} />
    </div>
  )
}

// A panel with its grey header strip and a few lines inside, the shape most of
// this portal is built from.
export function SkelPanel({ lines = 3, head = true }: { lines?: number; head?: boolean }) {
  const widths = ['w-3/5', 'w-full', 'w-4/5', 'w-2/3', 'w-full', 'w-1/2']
  return (
    <div className="bg-card border border-card-line rounded-xl overflow-hidden">
      {head && (
        <div className="px-3.5 py-2.5 border-b border-line-soft bg-gray-50">
          <div className={`${BLOCK} h-3 w-28`} />
        </div>
      )}
      <div className="px-3.5 py-3.5 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <SkelLine key={i} w={widths[i % widths.length]} />
        ))}
      </div>
    </div>
  )
}

// A few rows of a table, for the screens that are mostly a list.
export function SkelRows({ rows = 4, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card border border-card-line rounded-xl overflow-hidden">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 px-3.5 py-3 border-b border-line-soft last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={`${BLOCK} h-3 flex-1`} />
          ))}
        </div>
      ))}
    </div>
  )
}
