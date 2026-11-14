import Link from 'next/link'
import { viewingLine, type Somebody } from '@/lib/view-as'

// THE BLACK STRIP, AND IT IS LOUD ON PURPOSE.
//
// 12 Nov 2026. Looking at somebody else's Today and mistaking it for your own
// is the failure here - you wonder where the run-through went, or worse, you
// read their four deals as the whole business.
//
// So it is the darkest thing on the page and it stays at the top. It says
// whose day this is, that nothing here saves, and that they have not been
// told. All three are promises the rest of the feature has to keep.
export default function ViewingAsStrip({ who }: { who: Somebody }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-[11px] rounded-[11px] bg-ink px-3.5 py-2.5">
      <span className="rounded-[5px] bg-brand-lift px-[7px] py-0.5 text-[10px] font-extrabold
                       tracking-[0.06em] text-ink">
        VIEWING AS
      </span>
      <span className="text-[12.5px] leading-snug text-page/85">
        <b className="text-page">{who.name}</b>
        {viewingLine(who).slice(who.name.length)}
      </span>
      <Link href="/dashboard"
        className="ml-auto whitespace-nowrap rounded-lg bg-page px-3 py-[5px] text-[12px]
                   font-bold text-ink">
        Back to mine
      </Link>
    </div>
  )
}
