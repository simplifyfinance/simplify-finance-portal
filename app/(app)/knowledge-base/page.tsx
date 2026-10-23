'use client'
import { useEffect, useMemo, useState } from 'react'
import { PAGE_WIDE } from '@/lib/page-width'
import { copyHtmlAndPlain } from '@/lib/rich-text'
import {
  SECTIONS, entriesFor, readableDate, entryEmailHtml, sectionLabel,
  isBullets, isCall, isFigure, isStep, isShot, shotPath, stepNumber,
  isLong, readingMinutes, PREVIEW_BLOCKS,
  type Section, type Entry, type Block,
} from '@/lib/knowledge-base'

// WHAT CHANGED IN THE PORTAL, AND HOW WE DO THINGS NOW.
//
// 21 Oct 2026. Every team email so far lived in exactly one place - Fabio's
// sent items. Three weeks later a broker who cannot remember how a top up works
// has nowhere to look.
//
// THE PAGE AND THE EMAIL ARE ONE ENTRY. Copy for Outlook builds the email from
// the same words on screen, so the version in somebody's inbox and the version
// here cannot drift apart. See lib/knowledge-base.ts.

const PILL: Record<Section, string> = {
  templates: 'bg-done-bg border-done-edge text-done',
  features: 'bg-info-bg border-info-edge text-info',
  process: 'bg-waiting-bg border-waiting-edge text-waiting',
}

// ONE BLOCK, DRAWN. The shapes are in lib/knowledge-base.ts - a paragraph, a
// bullet list, a numbered step, a callout, a small table. Nothing here invents
// a colour: every one of them is a token the rest of the portal already uses.
function BlockView({ b, n }: { b: Block; n: number }) {
  if (isBullets(b)) return (
    <ul className="list-disc pl-[18px] mb-2.5">
      {b.map((x, j) => <li key={j} className="text-[13.5px] leading-relaxed text-body mb-1.5">{x}</li>)}
    </ul>
  )

  if (isCall(b)) return (
    <div className={`rounded-lg px-3.5 py-2.5 mb-2.5 border text-[12.5px] leading-relaxed ${
      b.watch ? 'bg-chase-bg border-chase-edge text-chase' : 'bg-info-bg border-info-edge text-info'}`}>
      <b className="block mb-0.5">{b.title}</b>
      {b.call}
    </div>
  )

  if (isFigure(b)) return (
    <div className="border border-line-soft rounded-lg bg-page px-3.5 py-3 mb-2.5">
      <p className="text-[10px] uppercase tracking-[.06em] text-faint mb-2">{b.figure}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr>{b.head.map((h, i) => (
            <th key={i} className={`text-[9.5px] uppercase tracking-[.05em] font-bold text-faint pb-1.5
                                    ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {b.rows.map((r, ri) => (
            <tr key={ri} className={b.win === ri ? 'bg-done-bg' : ''}>
              {r.map((c, ci) => (
                <td key={ci} className={`text-[12.5px] py-1.5 border-t border-line-soft
                  ${ci === 0 ? 'text-left text-body' : 'text-right font-bold text-ink'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (isStep(b)) return (
    <div className="flex gap-3 mb-3.5">
      <span className="flex-none w-[22px] h-[22px] rounded-full bg-ink text-page text-[11px]
                       font-bold flex items-center justify-center mt-[1px]">{n}</span>
      <div className="flex-1 min-w-0">
        <b className="block text-[13.5px] text-ink mb-1">{b.step}</b>
        {b.body.map((x, i) => <BlockView key={i} b={x} n={0} />)}
      </div>
    </div>
  )

  // A PICTURE OF THE SCREEN. Fabio, 21 Oct 2026: "images showing where things
  // are". Plain <img>, not next/image: these are in public/ at a fixed size and
  // the optimiser would only add a build step to a screenshot.
  if (isShot(b)) return (
    <figure className="m-0 mb-3">
      <img src={shotPath(b.shot)} alt={b.caption}
        className="block w-full h-auto rounded-lg border border-card-line" />
      <figcaption className="text-[11.5px] text-faint mt-1.5">{b.caption}</figcaption>
    </figure>
  )

  return <p className="text-[13.5px] leading-relaxed text-body mb-2.5">{b}</p>
}

export default function KnowledgeBasePage() {
  const [section, setSection] = useState<Section | 'all'>('all')
  const [find, setFind] = useState('')
  const [copied, setCopied] = useState('')
  const [why, setWhy] = useState('')
  // LONG ENTRIES OPEN ON ASKING. The lending options guide is six steps; six of
  // those on one page is something nobody scrolls. Searching opens everything,
  // because a hidden match looks like no match.
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => { document.title = 'Knowledge base — Simplify Finance' }, [])

  const shown = useMemo(() => entriesFor(section, find), [section, find])

  // EVERYTHING MEANS EVERYTHING, NEWEST FIRST.
  //
  // 23 Oct 2026. Fabio: "everything tab has to be cronological. So anything
  // that is newer, it sits at the top." Sorting entriesFor() by date on 22 Oct
  // was only half of it - this page then cut the list into three section
  // groups and drew them in a fixed order, so the newest thing in the portal
  // could be two headings down the page behind a guide from last week.
  //
  // On a named section the grouping is a heading over one list, which says
  // nothing the tab above it has not already said. So it goes there too.
  const grouped = useMemo(() => {
    if (section === 'all') return [{ key: 'all', label: '', blurb: '', items: shown }]
    return SECTIONS
      .map(s => ({ ...s, items: shown.filter(e => e.section === s.key) }))
      .filter(g => g.items.length > 0)
  }, [shown, section])

  async function copyOne(e: Entry) {
    setWhy(''); setCopied('')
    try {
      // copyHtmlAndPlain works the plain text out of the HTML itself, which
      // is what every other copy button in this portal does.
      await copyHtmlAndPlain(entryEmailHtml(e))
      setCopied(e.id)
    } catch (err: any) {
      setWhy(err?.message || 'Could not copy it. Select the text and copy it by hand.')
    }
  }

  return (
    <div className={PAGE_WIDE}>
      <h1 className="text-[20px] font-semibold text-ink mb-0.5">Knowledge base</h1>
      <p className="text-[12.5px] text-muted mb-4">What changed in the portal, and how we do things now.</p>

      <div className="flex gap-2 items-center flex-wrap mb-4">
        <div className="flex gap-1.5">
          {([['all', 'Everything'], ...SECTIONS.map(s => [s.key, s.label] as const)] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSection(k as Section | 'all')}
              className={`text-[12.5px] rounded-full px-3.5 py-[5px] border transition ${
                section === k ? 'bg-ink border-ink text-page font-semibold'
                              : 'bg-card border-line text-muted hover:bg-page'}`}>
              {l}
            </button>
          ))}
        </div>
        <input value={find} onChange={e => setFind(e.target.value)} placeholder="Search…"
          className="ml-auto text-[12.5px] border border-line rounded-lg px-3 py-[6px] bg-card text-ink
                     focus:outline-none focus:border-brand min-w-[190px]" />
      </div>

      {why && <p className="text-[12px] text-chase mb-3">{why}</p>}

      {grouped.length === 0 && (
        <p className="text-[13px] text-faint">Nothing here yet{find ? ' for that' : ''}.</p>
      )}

      {grouped.map(g => (
        <div key={g.key}>
          {g.label && (
            <p className="text-[10px] font-bold uppercase tracking-[.09em] text-faint mt-5 mb-2.5">
              {g.label}
            </p>
          )}
          {g.items.map(e => (
            <article key={e.id} id={e.id}
              className="bg-card border border-card-line rounded-xl px-[18px] py-4 mb-2.5">
              <div className="flex items-baseline gap-2.5 flex-wrap mb-1.5">
                <h2 className="text-[15px] font-semibold text-ink m-0">{e.title}</h2>
                <span className={`text-[9.5px] font-bold uppercase tracking-[.05em] rounded-full
                                  px-2 py-[2px] border ${PILL[e.section]}`}>
                  {sectionLabel(e.section)}
                </span>
                <span className="ml-auto text-[11.5px] text-faint">{readableDate(e.on)}</span>
              </div>

              <p className="text-[13.5px] leading-relaxed text-body mb-2.5">{e.lead}</p>
              {(() => {
                const shut = isLong(e) && !open[e.id] && !find.trim()
                const blocks = shut ? e.body.slice(0, PREVIEW_BLOCKS) : e.body
                return (
                  <>
                    <div className={shut ? 'relative max-h-[150px] overflow-hidden' : ''}>
                      {blocks.map((b, i) => (
                        <BlockView key={i} b={b} n={stepNumber(e.body, i)} />
                      ))}
                      {shut && (
                        <div className="absolute inset-x-0 bottom-0 h-[60px]
                                        bg-gradient-to-b from-transparent to-card" />
                      )}
                    </div>
                    {shut && (
                      <button onClick={() => setOpen({ ...open, [e.id]: true })}
                        className="text-[12px] font-semibold text-info bg-info-bg border border-info-edge
                                   rounded-lg px-3 py-[6px] mt-1.5">
                        Read the lot — {readingMinutes(e)} min
                      </button>
                    )}
                  </>
                )
              })()}

              <div className="flex gap-2 mt-3 pt-[11px] border-t border-line-soft">
                <button onClick={() => copyOne(e)}
                  className="text-[11.5px] bg-ink text-page rounded-lg px-3 py-[6px] font-semibold">
                  {copied === e.id ? 'Copied — paste into Outlook' : 'Copy for Outlook'}
                </button>
                <button onClick={() => {
                  // The link somebody pastes into a chat so a colleague lands
                  // on this entry rather than the top of the page.
                  navigator.clipboard?.writeText(`${window.location.origin}/knowledge-base#${e.id}`)
                  setCopied(`link:${e.id}`)
                }}
                  className="text-[11.5px] border border-line bg-card rounded-lg px-3 py-[6px] text-ink hover:bg-page transition">
                  {copied === `link:${e.id}` ? 'Link copied' : 'Copy link'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ))}
    </div>
  )
}
