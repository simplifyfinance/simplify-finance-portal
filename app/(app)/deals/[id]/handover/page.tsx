'use client'
// THE HANDOVER SCREEN.
//
// One scrolling page holding the handover boxes and the whole fact find, with a
// Copy button on every box. It exists because copying out of a PDF is lossy:
// text extraction puts hard line breaks mid-sentence, splits words across lines
// with a hyphen, and drops the bold. The overseas team pastes these boxes into
// SalesTrekker all day. Fabio, 2 Sep 2026: "maybe one big flow wit copy buttons".
//
// The PDFs stay. They are the compliance record and they are what gets attached
// to the push email; this is what people actually type from, and the email links
// here.
//
// What is on the page comes from lib/handover-view.ts, not from this file, so
// the screen and the two PDFs cannot drift apart about what a box contains.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { allSections, copyableCards, copyTextOf, outstanding,
         type ViewSection, type ViewCard, type Accent } from '@/lib/handover-view'
import { applicantNamesOf } from '@/lib/applicants'
import { money, readMoney } from '@/lib/money'

type Shade = { edge: string; tint: string; ink: string }
const SHADES: Record<Accent, Shade> = {
  ink:    { edge: '#141C24', tint: '#F4F6F8', ink: '#141C24' },
  blue:   { edge: '#2DBEFF', tint: '#EAF6FD', ink: '#0B5E8A' },
  teal:   { edge: '#14A08B', tint: '#E6F5F2', ink: '#0C6355' },
  violet: { edge: '#7C6BD6', tint: '#F1EEFB', ink: '#463A8C' },
  green:  { edge: '#22A559', tint: '#EAF7EF', ink: '#15803D' },
  slate:  { edge: '#8B9AA8', tint: '#F1F4F7', ink: '#3E4C59' },
  navy:   { edge: '#2F5D8C', tint: '#EBF1F8', ink: '#1F3D5C' },
  amber:  { edge: '#D9A441', tint: '#FDF6E7', ink: '#8A6218' },
  red:    { edge: '#E06A62', tint: '#FDF0EF', ink: '#B23A34' },
}
const GOOD = { edge: '#22A559', tint: '#EAF7EF', ink: '#15803D' }

type Progress = Record<string, { at: string; by: string }>

export default function HandoverPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = useMemo(() => createSupabaseBrowser(), [])
  const [deal, setDeal] = useState<any>(null)
  const [progress, setProgress] = useState<Progress>({})
  const [me, setMe] = useState('')
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<any>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      const { data, error } = await supabase.from('deals')
        .select('*, clients(first_name, last_name), lenders(name)').eq('id', id).single()
      if (!live) return
      if (error || !data) { setProblem('Could not load this deal.'); setLoading(false); return }
      setDeal(data)
      setProgress((data.handover_progress as Progress) || {})
      setLoading(false)
      const { data: u } = await supabase.auth.getUser()
      if (u?.user?.id) {
        const { data: p } = await supabase.from('user_profiles').select('full_name').eq('id', u.user.id).single()
        if (live) setMe(p?.full_name || u.user.email || '')
      }
    })()
    return () => { live = false }
  }, [id, supabase])

  const sections: ViewSection[] = useMemo(() => (deal ? allSections(deal) : []), [deal])
  // Only the written boxes have a Copy button, so only they count towards
  // "8 of 24 copied" and only they are what Jump to next jumps to.
  const cards = useMemo(() => copyableCards(sections), [sections])
  const gaps = useMemo(() => (deal ? outstanding(deal) : []), [deal])
  const doneCount = cards.filter(c => progress[c.key]).length

  function say(msg: string) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1600)
  }

  // The tick is saved with the deal, so a staff member who closes the tab, or a
  // second person picking the file up, sees where the work got to. The clipboard
  // is written first and never waits on the database: a copy that worked must
  // never look like it failed because a save was slow.
  async function copyCard(card: ViewCard) {
    const text = copyTextOf(card)
    try { await navigator.clipboard.writeText(text) }
    catch { say('Your browser blocked the clipboard — select the box and copy by hand.'); return }
    say('Copied — ' + card.title)

    const next: Progress = { ...progress, [card.key]: { at: new Date().toISOString(), by: me } }
    setProgress(next)
    const failed = await checkedWrite(
      supabase.from('deals').update({ handover_progress: next }).eq('id', id), 'The copied tick')
    // The paste already happened, so this is not an error to block on - but a
    // tick that silently did not save would have somebody redo the whole
    // handover tomorrow, so it is said out loud.
    if (failed) { setProgress(progress); setProblem(failed + ' The text is on your clipboard — the tick is not saved.') }
    else setProblem('')
  }

  async function copyValue(v: string) {
    try { await navigator.clipboard.writeText(v); say('Copied “' + v + '”') }
    catch { say('Your browser blocked the clipboard.') }
  }

  function jumpToNext() {
    const next = cards.find(c => !progress[c.key])
    if (!next) { say('Every box has been copied'); return }
    const el = document.getElementById('card-' + next.key)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.animate?.([{ boxShadow: '0 0 0 0 rgba(45,190,255,.55)' }, { boxShadow: '0 0 0 14px rgba(45,190,255,0)' }],
                 { duration: 700 })
  }

  if (loading) return <div className="p-8 text-[13px] text-[#7C8894]">Loading the handover…</div>
  if (!deal) return <div className="p-8 text-[13px] text-[#B23A34]">{problem || 'Deal not found.'}</div>

  const names = applicantNamesOf(deal, deal.bc_data || {})
  const who = names.join(' & ')
  const c = deal.compliance_data || {}
  const loanAmount = readMoney(deal.loan_amount)
  const lvr = readMoney((deal.bc_data || {}).lvrPercent)
  const words = (v: any) => {
    const t = String(v || '').replace(/_/g, ' ').trim()
    return t ? t[0].toUpperCase() + t.slice(1) : ''
  }
  const meta = [
    c.preApproval ? 'Pre-approval — no security yet' : '',
    words(deal.transaction_type),
    deal.lenders?.name || (deal.lo_data || {}).recommendedLender || '',
    loanAmount !== null ? money(loanAmount) : '',
    words(deal.property_use),
  ].filter(Boolean).join('  ·  ')

  return (
    <div className="min-h-screen bg-[#F1F4F7] pb-24">
      {/* masthead */}
      <div className="bg-[#141C24] text-white">
        <div className="max-w-[1120px] mx-auto px-5 pt-6 pb-5 flex items-end gap-5 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <Link href={`/deals/${id}`} className="text-[11px] text-[#7FD3FF] hover:underline">&larr; Back to the deal</Link>
            <div className="text-[10px] font-bold tracking-[.18em] text-[#2DBEFF] mt-3">HANDOVER &amp; FACT FIND</div>
            <h1 className="text-[23px] font-bold mt-1.5 mb-1">{who}</h1>
            {meta && <div className="text-[12.5px] text-[#A9B7C2]">{meta}</div>}
          </div>
          {lvr !== null && (
            <div className="text-right">
              <div className="text-[26px] font-bold text-[#2DBEFF] leading-none">{lvr}%</div>
              <div className="text-[9px] font-bold tracking-[.12em] text-[#7C8894] mt-1">LVR</div>
            </div>
          )}
        </div>
      </div>

      {/* progress, sticky so somebody working down the page always knows where they are */}
      <div className="sticky top-0 z-40 bg-white border-b border-[#E3E7EA] shadow-[0_1px_4px_rgba(20,28,36,.05)]">
        <div className="max-w-[1120px] mx-auto px-5 py-2.5 flex items-center gap-3.5 flex-wrap">
          <div className="text-[12.5px] font-bold text-[#141C24] whitespace-nowrap">
            {doneCount} of {cards.length} copied
          </div>
          <div className="flex-1 min-w-[160px] h-[7px] rounded bg-[#E9EDF1] overflow-hidden">
            <div className="h-full bg-[#22A559] transition-[width] duration-200"
                 style={{ width: cards.length ? `${doneCount / cards.length * 100}%` : '0%' }} />
          </div>
          <button onClick={jumpToNext}
            className="bg-[#141C24] hover:bg-[#28323c] text-white rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold">
            Jump to next &darr;
          </button>
        </div>
        <div className="max-w-[1120px] mx-auto px-5 pb-2.5 flex gap-1.5 overflow-x-auto">
          {sections.map(s => {
            const box = s.cards.filter(x => x.copyable)
            const n = box.filter(x => progress[x.key]).length
            const all = box.length > 0 && n === box.length
            const sh = all ? GOOD : SHADES[s.accent]
            return (
              <a key={s.key} href={'#sec-' + s.key}
                 className="rounded-full border px-3 py-[5px] text-[12px] font-semibold whitespace-nowrap"
                 style={{ borderColor: all ? sh.edge : '#E3E7EA', background: all ? sh.tint : '#fff', color: sh.ink }}>
                {s.title}{box.length > 0 && <span className="opacity-60"> {n}/{box.length}</span>}
              </a>
            )
          })}
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-5">
        {problem && (
          <div className="mt-4 rounded-lg border border-[#E5B7B2] bg-[#FDF0EF] text-[#B23A34] px-4 py-3 text-[13px]">
            {problem}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-[#CBE7F8] bg-[#EAF6FD] text-[#0B5E8A] px-4 py-3.5 text-[13px] leading-relaxed">
          <b className="text-[#141C24]">How this works.</b> The written boxes — the ones with a <b>Copy box</b>
          button — are single fields in SalesTrekker with the same name. Press the button, paste it into that
          field, and the box turns green so you can see where you got to. The ticks are saved, so you can stop
          and come back, and anyone else on this deal sees the same progress.
          <br /><br />
          Everything else on this page is a list of separate fields. <b>Click any row to copy just that value</b>
          — one row, one field. Do not retype and do not summarise: the wording is the compliance record.
        </div>

        {sections.map((s, si) => {
          const sh = SHADES[s.accent]
          // SalesTrekker splits its menu into Client profile and Home loan, and
          // this page runs in the same order, so it carries the same divide.
          const newGroup = s.group && s.group !== sections[si - 1]?.group
          return (
            <div key={s.key}>
              {newGroup && (
                <div className="flex items-center gap-3 mt-9 mb-1">
                  <span className="text-[11px] font-bold tracking-[.16em] text-[#7C8894]">
                    {s.group!.toUpperCase()}
                  </span>
                  <span className="flex-1 h-px bg-[#DCE1E6]" />
                </div>
              )}
              <div id={'sec-' + s.key} className="scroll-mt-28 flex items-center gap-2.5 rounded-md mt-7 mb-2.5 px-3.5 py-2.5"
                   style={{ background: sh.tint, borderLeft: `5px solid ${sh.edge}`, color: sh.ink }}>
                <span className="text-[12px] font-bold tracking-[.11em]">{s.title.toUpperCase()}</span>
                {s.pill && (
                  <span className="ml-auto rounded-full bg-white border px-2.5 py-[2px] text-[10px] font-bold tracking-[.05em]"
                        style={{ borderColor: sh.edge }}>{s.pill.toUpperCase()}</span>
                )}
              </div>
              {s.cards.map(card => (
                <CardBlock key={card.key} card={card} shade={sh}
                           done={progress[card.key]} onCopy={() => copyCard(card)} onValue={copyValue} />
              ))}
            </div>
          )
        })}

        {gaps.length > 0 && (
          <div className="mt-7 rounded-xl border border-[#EBD9BE] bg-[#FDF6E7] text-[#8A6218] px-4 py-3.5 text-[13px] leading-relaxed">
            <b>Still to confirm — {gaps.length}.</b>
            <ul className="mt-1.5 mb-0 pl-4 list-disc">{gaps.map(g => <li key={g}>{g}</li>)}</ul>
            <p className="mt-2 mb-0 text-[11.5px] text-[#a08a5e]">
              These are gaps in the fact find, not gaps in this page. Nothing can be copied for them because
              nobody has answered them yet.
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 bg-[#141C24] text-white rounded-lg px-4 py-2.5 text-[13px] font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

// Declared at module level, never inside the page. A component defined inside
// another component is a new type on every render, so React throws the old tree
// away and every field loses focus. This codebase has been bitten by that twice.
function CardBlock({ card, shade, done, onCopy, onValue }: {
  card: ViewCard; shade: Shade; done?: { at: string; by: string }
  onCopy: () => void; onValue: (v: string) => void
}) {
  const sh = done ? GOOD : shade
  const tagWarn = card.tone === 'warn'
  return (
    <div id={'card-' + card.key}
         className="bg-white rounded-[9px] border mb-3 overflow-hidden scroll-mt-28"
         style={{ borderColor: done ? GOOD.edge : '#E3E7EA', borderLeft: `3px solid ${sh.edge}` }}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#E3E7EA]"
           style={{ background: sh.tint }}>
        {card.no !== undefined && (
          <span className="w-[22px] h-[22px] rounded-full bg-[#141C24] text-white text-[11px] font-bold grid place-items-center shrink-0">
            {card.no}
          </span>
        )}
        <span className="text-[14.5px] font-bold" style={{ color: sh.ink }}>{card.title}</span>
        {card.tag && (
          <span className="ml-auto rounded text-[10px] font-bold tracking-[.05em] px-2 py-[3px]"
                style={tagWarn
                  ? { background: SHADES.amber.edge, color: '#fff' }
                  : { background: '#fff', color: sh.ink, border: `1px solid ${sh.edge}` }}>
            {card.tag.toUpperCase()}
          </span>
        )}
        {card.copyable
          ? (
            <button onClick={onCopy}
              className={'shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold border '
                + (card.tag ? 'ml-2.5 ' : 'ml-auto ')}
              style={done
                ? { background: GOOD.tint, borderColor: GOOD.edge, color: GOOD.ink }
                : { background: '#141C24', borderColor: '#141C24', color: '#fff' }}>
              {done ? 'Copied ✓' : 'Copy box'}
            </button>
          )
          : (
            // No whole-card button here on purpose: these rows are separate
            // SalesTrekker fields and a clipboard holding all of them at once
            // pastes into none of them.
            <span className={'shrink-0 text-[11.5px] text-[#8B9AA8] ' + (card.tag ? 'ml-2.5' : 'ml-auto')}>
              click a row to copy it
            </span>
          )}
      </div>

      <div className="px-3.5 py-3">
        {card.blocks?.map((b, i) => b.kind === 'rule'
          ? <hr key={i} className="my-3 border-0 border-t border-[#E3E7EA]" />
          : (
            <p key={i} className="m-0 mb-2 last:mb-0 text-[13.5px] leading-[1.65]">
              {b.runs.map((r, j) => r.bold
                ? <b key={j} className="text-[#141C24]">{r.text}</b>
                : <span key={j}>{r.text}</span>)}
            </p>
          ))}

        {card.rows?.map((r, i) => r.kind === 'sub'
          ? (
            <div key={i} className="inline-block rounded px-2 py-[3px] mt-3 mb-1.5 text-[10px] font-bold tracking-[.09em]"
                 style={{ background: shade.tint, color: shade.ink }}>
              {r.text.toUpperCase()}
            </div>
          )
          : (
            <button key={i} onClick={() => onValue(r.v)} title="Copy this value"
              className="w-full flex gap-[3px] mb-[3px] text-left group">
              <span className="flex-1 rounded-l bg-[#F6F8FA] group-hover:bg-[#EAF6FD] px-2.5 py-1.5 text-[12.5px]">
                {r.k}
                {r.state === 'unanswered' && (
                  <span className="ml-2 text-[11px] font-bold text-[#B23A34]">needs a HEM answer</span>
                )}
              </span>
              <span className="w-[290px] rounded-r bg-[#F6F8FA] group-hover:bg-[#EAF6FD] px-2.5 py-1.5 text-[12.5px] font-bold text-[#141C24] text-right">
                {r.v}
              </span>
            </button>
          ))}

        {card.note && (
          <div className="mt-2 rounded-lg border border-[#EBD9BE] bg-[#FDF6E7] text-[#8A6218] px-3 py-2.5 text-[12.5px] leading-relaxed">
            {card.note}
          </div>
        )}

        {done && (
          <div className="mt-2.5 text-[11px] text-[#8B9AA8]">
            Copied {new Date(done.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            {done.by ? ' by ' + done.by : ''}
          </div>
        )}
      </div>
    </div>
  )
}
