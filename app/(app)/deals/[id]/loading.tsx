import { PAGE_WIDE } from '@/lib/page-width'

// A DEAL THAT IS OPENING SAYS SO.
//
// 22 Nov 2026. Belle and Ellesse, after a week on the settlement process:
// "When I click on a deal, it doesn't open immediately. There's a bit delay
// before the deal loads."
//
// They were right, and nothing was broken. Opening a deal runs database
// queries on the server before a single pixel changes, and until this file
// existed there was no loading screen ANYWHERE in the portal - so the browser
// sat on the board, looking like the click had missed. The other half of the
// fix is in page.tsx, where the role and the deal now go together instead of
// one after the other.
//
// Fabio's rule, 16 Nov 2026: the screen is never blank.
//
// IT IS THE SHAPE OF WHAT IS COMING, not a spinner. A spinner says "wait"; this
// says "the deal is opening, and here is where its name and its stages will
// be", so the eye is already in the right place when the real thing lands.
// See docs/approved-looks/the-team-week-one.html.
//
// NOTHING HERE READS A DEAL. Next draws this before the page's own queries
// have answered, so it cannot know the client, the stage or the lender. It
// says only what is true of every deal.

const SK = 'bg-line-soft rounded-md animate-pulse'

export default function Loading() {
  return (
    <div className={PAGE_WIDE}>
      {/* The same breadcrumb the deal page draws, so this line does not jump
          when the real one arrives. */}
      <nav className="flex items-center gap-1.5 text-sm mb-4">
        <span className="text-muted">Deals</span>
        <span className="text-faint">/</span>
        <span className="text-ink font-semibold">Opening…</span>
      </nav>

      <div className="bg-card border border-card-line rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line-soft">
          <span className="w-3.5 h-3.5 rounded-full bg-done-bg border border-done-edge" />
          <span className="text-[10.5px] font-extrabold tracking-[.08em] uppercase text-done">
            The deal
          </span>
          <span className="flex-1" />
          <span className="text-[11.5px] text-faint">Opening…</span>
        </div>
        <div className="p-4">
          <div className={`${SK} h-[19px] w-[62%]`} />
          <div className={`${SK} h-[19px] w-[38%] mt-2`} />
          <div className="mt-4">
            <div className={`${SK} h-3 w-[46%]`} />
            <div className={`${SK} h-3 w-[40%] mt-2.5`} />
            <div className={`${SK} h-3 w-[43%] mt-2.5`} />
          </div>
        </div>
      </div>

      <div className="bg-card border border-card-line rounded-2xl overflow-hidden mt-3">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line-soft">
          <span className="w-3.5 h-3.5 rounded-full bg-done-bg border border-done-edge" />
          <span className="text-[10.5px] font-extrabold tracking-[.08em] uppercase text-done">
            Where it is
          </span>
        </div>
        <div className="p-4">
          {/* Seven beads and the rail between them - the shape of the bar on a
              lodged deal, which is most of what anybody opens. */}
          <div className="flex items-center">
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <span className={`${SK} w-[21px] h-[21px] rounded-full flex-none`} />
                {i < 6 && <span className="h-[2px] flex-1 bg-line-soft" />}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="border border-card-line rounded-xl p-3.5">
                <span className={`${SK} block w-[17px] h-[17px]`} />
                <span className={`${SK} block h-3 mt-3`} style={{ width: `${58 + i * 7}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
