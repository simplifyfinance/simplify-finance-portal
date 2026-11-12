'use client'
import { useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import {
  buildPartnerNote, dealsOf, draftNote, lineFor, periodsFor, scoreOf,
  type PeriodKey,
} from '@/lib/the-partner-note'

// A NOTE TO A REFERRAL PARTNER.
//
// Fabio, 12 Nov 2026, on the Friday email that sent four at once on a timer:
// "the whole thing of the Friday email is shit."
//
// The fault was the automation. A report to management on a timer is fine. An
// email to a referral partner is a relationship, and the portal was writing
// it, choosing the week, and sending it from notifications@ with nothing but a
// preview between him and the send.
//
// SO THE PORTAL BRINGS THE FACTS AND HE BRINGS THE WORDS. One partner, chosen
// on purpose. A first draft he can rewrite. Ticked periods rather than a fixed
// week. And it does not send: it hands him the HTML and he pastes it into
// whichever mailbox he wants it to come from, which settles who it is from
// without the portal pretending to be anybody.
//
// "MARK AS SENT" IS THE ONLY THING IT NEEDS BACK. The portal cannot see his
// mailbox, so without that press it would go on saying a partner has not been
// contacted since October.

type Split = {
  id: string
  name: string
  kind?: string
  who?: string
  contact_email?: string | null
  note_template?: string | null
  last_sent_at?: string | null
  last_sent_by?: string | null
  active?: boolean
}
type Brand = { id?: any; name?: any; headerColor?: any; accentColor?: any }

const CARD = 'bg-card border border-card-line rounded-xl'
const CAP = 'text-[9.5px] font-bold tracking-[.09em] uppercase text-faint'

export default function PartnerNote({ deals, splits, brands, meName, today }: {
  deals: any[]
  splits: Split[]
  brands: Brand[]
  meName?: string
  today?: string
}) {
  const supabase = createSupabaseBrowser()
  const periods = useMemo(() => periodsFor(today), [today])

  const [who, setWho] = useState<string>('')
  const [brandId, setBrandId] = useState<string>(() => String(brands?.[0]?.id ?? ''))
  const [ticked, setTicked] = useState<PeriodKey[]>(['week', 'month'])
  // HIS WORDS ONLY. The draft is worked out below rather than written into
  // state by an effect - an effect that rewrites a box while somebody is
  // typing in it is the rudest thing a form can do, and React warns about it
  // for good reason.
  const [mine, setMine] = useState<string | null>(null)
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')
  const [sentAt, setSentAt] = useState<Record<string, string>>({})

  // Only partners somebody could actually write to. A broker split is an
  // internal arrangement, not a referrer.
  const partners = useMemo(() => (splits || [])
    .filter(s => s?.active !== false && s.kind !== 'broker_split' && String(s.name || '').trim())
    .sort((a, b) => String(a.name).localeCompare(String(b.name))), [splits])

  const week = periods[0]
  const countFor = (id: string) =>
    dealsOf(deals, id, 'lodged', week).length + dealsOf(deals, id, 'settled', week).length

  const partner = partners.find(p => p.id === who) || null
  const brand = useMemo(
    () => (brands || []).find(b => String(b?.id) === brandId) || brands?.[0] || {},
    [brands, brandId])

  const chosen = periods.filter(p => ticked.includes(p.key))
  const main = chosen[0] || week
  const mainScore = useMemo(
    () => (partner ? scoreOf(deals, partner.id, main) : null),
    [deals, partner, main])

  // THE FIRST DRAFT: their name, what moved, and whatever he saved last time.
  const drafted = useMemo(() => {
    if (!partner) return ''
    const first = String(partner.who || partner.name || '').trim().split(/\s+/)[0]
    return draftNote(first,
      mainScore || { lodged: 0, settled: 0, lodgedAmount: 0, settledAmount: 0 },
      partner.note_template)
  }, [partner, mainScore])

  const note = mine ?? drafted

  const built = useMemo(() => {
    if (!partner) return null
    return buildPartnerNote({
      brand,
      note,
      main: {
        label: main.label,
        lodged: dealsOf(deals, partner.id, 'lodged', main).map(d => lineFor(d, 'lodged')),
        settled: dealsOf(deals, partner.id, 'settled', main).map(d => lineFor(d, 'settled')),
      },
      also: chosen.slice(1).map(p => ({ label: p.label, score: scoreOf(deals, partner.id, p) })),
      from: { name: meName || '', brandName: String(brand?.name || '') },
    })
  }, [partner, brand, note, main, chosen, deals, meName])

  function toggle(k: PeriodKey) {
    setTicked(t => t.includes(k) ? t.filter(x => x !== k) : [...periods.map(p => p.key)]
      .filter(x => t.includes(x) || x === k))
  }

  async function copy(what: 'html' | 'text' | 'to' | 'subject') {
    if (!built || !partner) return
    try {
      if (what === 'html' && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([built.html], { type: 'text/html' }),
          'text/plain': new Blob([built.text], { type: 'text/plain' }),
        })])
      } else {
        await navigator.clipboard.writeText(
          what === 'to' ? String(partner.contact_email || '')
          : what === 'subject' ? built.subject
          : what === 'text' ? built.text : built.html)
      }
      setCopied(what)
      setTimeout(() => setCopied(''), 2500)
    } catch {
      setSaid('Your browser would not let me reach the clipboard. Select it and copy by hand.')
    }
  }

  async function saveNote() {
    if (!partner) return
    setBusy(true); setSaid('')
    const body = note.replace(/^Hi [^\n]*\n+/, '')
    const err = await checkedWrite(
      supabase.from('commission_splits').update({ note_template: body }).eq('id', partner.id),
      'Your note')
    setBusy(false)
    setSaid(err || 'Saved. It will come up next time.')
  }

  async function markSent() {
    if (!partner) return
    setBusy(true); setSaid('')
    const now = new Date().toISOString()
    const err = await checkedWrite(
      supabase.from('commission_splits')
        .update({ last_sent_at: now, last_sent_by: meName || null }).eq('id', partner.id),
      'The record')
    setBusy(false)
    if (err) { setSaid(err); return }
    setSentAt(s => ({ ...s, [partner.id]: now }))
    setSaid('Recorded.')
  }

  const lastSent = (p: Split) => sentAt[p.id] || p.last_sent_at || ''

  return (
    <div className="bg-page border border-card-line rounded-2xl px-4 py-3.5 mt-5">
      <p className={CAP + ' m-0 mb-0.5'}>A note to a referral partner</p>
      <p className="text-[11.5px] text-faint m-0 mb-3 leading-[1.5] max-w-[720px]">
        Nothing sends from here. You copy it and paste it into whichever account you want it to
        come from.
      </p>

      {/* WHO IT IS FOR. A partner with nothing this week is still listed,
        * greyed - that they have sent you nothing for a month is its own
        * kind of news. */}
      <div className="flex gap-2 flex-wrap mb-3">
        {partners.map(p => {
          const n = countFor(p.id)
          const on = p.id === who
          return (
            <button key={p.id}
              onClick={() => { setWho(p.id); setMine(null); setSaid('') }}
              className={`text-left border rounded-[10px] px-3 py-2 transition ${
                on ? 'bg-ink border-ink' : 'bg-card border-line hover:bg-page'} ${
                n === 0 && !on ? 'opacity-55' : ''}`}>
              <span className={`block text-[13px] font-bold ${on ? 'text-page' : 'text-ink'}`}>
                {p.name}
              </span>
              <span className={`block text-[11.5px] ${on ? 'text-[#B9B4AC]' : 'text-muted'}`}>
                {n ? `${n} ${n === 1 ? 'client' : 'clients'} this week` : 'nothing this week'}
              </span>
            </button>
          )
        })}
        {partners.length === 0 && (
          <p className="text-[12.5px] text-faint m-0">
            No referral partners are set up. Settings → Commission splits.
          </p>
        )}
      </div>

      {partner && (
        <>
          <div className={CARD + ' mb-2'}>
            <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 border-b border-line-soft">
              <span className="text-[13px] font-bold text-ink">Banner</span>
              <span className="text-[11.5px] text-faint">
                you send it from the matching account
              </span>
              {lastSent(partner) && (
                <span className="ml-auto text-[11.5px] text-done font-semibold">
                  Last sent {new Date(lastSent(partner)).toLocaleDateString('en-AU',
                    { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' })}
                </span>
              )}
            </div>
            <div className="px-3.5 py-2.5 flex gap-2 flex-wrap">
              {(brands || []).map(b => (
                <button key={String(b.id)} onClick={() => setBrandId(String(b.id))}
                  className={`inline-flex items-center gap-2 border rounded-[10px] px-3 py-1.5
                    text-[12.5px] ${String(b.id) === brandId
                      ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)] text-ink font-semibold'
                      : 'border-line text-muted hover:bg-page'}`}>
                  <span className="w-[15px] h-[15px] rounded"
                    style={{ background: String(b.headerColor || '#343333') }} />
                  {String(b.name || 'Brand')}
                </button>
              ))}
            </div>
          </div>

          <div className={CARD + ' mb-2'}>
            <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 border-b border-line-soft">
              <span className="text-[13px] font-bold text-ink">What goes in</span>
              <span className="text-[11.5px] text-faint">
                the first one ticked brings the client list; the rest are scoreboards
              </span>
            </div>
            <div className="px-3.5 py-2.5 flex gap-2 flex-wrap">
              {periods.map(p => {
                const on = ticked.includes(p.key)
                return (
                  <button key={p.key} onClick={() => toggle(p.key)}
                    className={`inline-flex items-center gap-2 border rounded-[10px] px-3.5 py-2
                      text-[12.5px] ${on
                        ? 'bg-ink border-ink text-page font-semibold'
                        : 'bg-card border-line text-muted hover:bg-page'}`}>
                    <span className={`w-[13px] h-[13px] rounded-[3px] border ${
                      on ? 'bg-brand border-brand' : 'border-line'}`} />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={CARD + ' mb-2'}>
            <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 border-b border-line-soft">
              <span className="text-[13px] font-bold text-ink">Your note</span>
              <span className="text-[11.5px] text-faint">
                the only part they read as you
              </span>
              <button onClick={() => void saveNote()} disabled={busy}
                className="ml-auto text-[11.5px] font-semibold text-brand-ink hover:underline
                  disabled:opacity-50">
                Save this as my usual note for {partner.name}
              </button>
            </div>
            <div className="px-3.5 py-2.5">
              <textarea value={note} rows={5}
                onChange={e => setMine(e.target.value)}
                className="w-full text-[13px] leading-[1.65] text-ink bg-card border border-line
                  rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand" />
              {mine !== null && (
                <button onClick={() => setMine(null)}
                  className="text-[11.5px] text-muted hover:text-ink mt-1.5">
                  Back to the draft
                </button>
              )}
            </div>
          </div>

          <div className={CARD}>
            <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 border-b border-line-soft">
              <span className={CAP}>To</span>
              <span className="text-[12.5px] text-muted">
                {partner.contact_email || 'no email on this partner — Settings → Commission splits'}
              </span>
              {partner.contact_email && (
                <button onClick={() => void copy('to')}
                  className="ml-auto text-[11.5px] font-semibold text-brand-ink">
                  {copied === 'to' ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 border-b border-line-soft">
              <span className={CAP}>Subject</span>
              <span className="text-[12.5px] text-muted">{built?.subject}</span>
              <button onClick={() => void copy('subject')}
                className="ml-auto text-[11.5px] font-semibold text-brand-ink">
                {copied === 'subject' ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* THE BOX IS THE EMAIL, not a preview of it. What goes on the
              * clipboard is this, formatting and all. */}
            <div className="bg-[#EFEAE1] dark:bg-panel px-4 py-4 flex justify-center">
              <div className="w-[600px] max-w-full shadow-sm"
                dangerouslySetInnerHTML={{ __html: built?.html || '' }} />
            </div>

            <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-line-soft
              flex-wrap">
              <button onClick={() => void copy('html')}
                className="text-[12.5px] font-semibold rounded-lg px-4 py-2 bg-ink text-page">
                {copied === 'html' ? '✓ Copied' : 'Copy the email'}
              </button>
              <span className="text-[11.5px] text-faint">
                Paste straight into Outlook or Gmail — it keeps all of this.
              </span>
              <button onClick={() => void copy('text')}
                className="ml-auto text-[11.5px] font-semibold text-brand-ink">
                {copied === 'text' ? 'Copied' : 'Copy as plain text instead'}
              </button>
            </div>

            <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-line-soft
              bg-[#FCFBF9] dark:bg-panel flex-wrap">
              <span className="text-[11.5px] text-faint">
                Tell the portal you sent it, so it stops asking.
              </span>
              {said && <span className="text-[11.5px] text-done font-semibold">{said}</span>}
              <button onClick={() => void markSent()} disabled={busy}
                className="ml-auto text-[12px] font-semibold rounded-lg px-3 py-1.5 border
                  border-line bg-card text-muted hover:bg-page disabled:opacity-50">
                Mark as sent
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
