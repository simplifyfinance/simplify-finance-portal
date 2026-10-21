'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { COPY_BLOCKS, blockText, isDefaultText, copyToStore, reviewEmailHtml }
  from '@/lib/portfolio-review-email'
import { SkelPanel } from '@/components/Skeleton'

// THE WORDING OF THE OPPORTUNITY EMAIL, ON A SCREEN.
//
// 21 Oct 2026. Fabio agreed every line of this email on 19 October and then had
// no way to change a word of it without asking me. The email has always
// accepted an override - ReviewFigures has been reading
// settings.portfolio_review_copy since it shipped - and nothing wrote one.
//
// WORDING ONLY, AND THAT IS ENFORCED BY THE SHAPE. There is no box here that
// can hold a figure. The price, the equity release, the deposit and the loan
// come from each client's own review, which is the rule the email was built on
// and the reason a template can never carry a number to 656 people.

const GROUPS = ['Opening', 'Why now', 'Negative gearing', 'Close'] as const

const TA = 'w-full text-[12.5px] leading-relaxed border border-line rounded-lg px-3 py-2 '
  + 'text-ink bg-card focus:outline-none focus:border-brand font-sans'
const BTN = 'text-[12px] border border-line bg-card rounded-lg px-3.5 py-2 text-ink hover:bg-page transition disabled:opacity-40'
const DARK = 'text-[12px] bg-ink text-page rounded-lg px-4 py-2 font-semibold disabled:opacity-40'

export default function ReviewEmailCopy() {
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState('')
  const [said, setSaid] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.from('settings').select('portfolio_review_copy').eq('id', 'singleton').maybeSingle()
      .then(({ data }) => {
        const saved = data?.portfolio_review_copy || {}
        const next: Record<string, string> = {}
        for (const b of COPY_BLOCKS) next[b.key] = blockText(saved, b)
        setForm(next)
        setLoading(false)
      })
  }, [])

  function resetOne(key: string) {
    const b = COPY_BLOCKS.find(x => x.key === key)
    if (b) setForm(prev => ({ ...prev, [key]: blockText({}, b) }))
  }

  function resetAll() {
    const next: Record<string, string> = {}
    for (const b of COPY_BLOCKS) next[b.key] = blockText({}, b)
    setForm(next)
  }

  async function save() {
    setBusy(true); setWhy(''); setSaid('')
    const supabase = createSupabaseBrowser()
    // RLS REFUSES BY RETURNING NO ROWS AND NO ERROR, so a write that saved
    // nothing has to be caught by the row count, not by `error` alone.
    const { data, error } = await supabase.from('settings')
      .upsert({ id: 'singleton', portfolio_review_copy: copyToStore(form),
                updated_at: new Date().toISOString() })
      .select('id')
    if (error || !data?.length) {
      setWhy(error?.message
        || 'That would not save, so nothing was changed. The wording on screen is not live yet.')
      setBusy(false)
      return
    }
    setSaid('Saved. Every review sent from now on uses this wording; the ones already sent are not rewritten.')
    setBusy(false)
  }

  // A WORKED EXAMPLE, NEVER A REAL CLIENT. Nobody's figures belong on a
  // settings page, and the point of the preview is the words.
  const previewHtml = () => reviewEmailHtml({
    greeting: 'Ruth',
    equityAddress: '52 Example Ave, Sampletown',
    purchasePrice: '520000', stampDuty: '28000', loanAmount: '385000',
    equityRelease: '130000', savings: '33000', buffer: '20000',
    loanNote: 'your maximum borrowing capacity with a non-bank lender',
    brokerName: 'Fabio De Castro', brokerTitle: 'Director, Simplify Finance',
    calendlyUrl: '#',
    copy: copyToStore(form),
  })

  // THE SHAPE, NOT A LINE OF GREY TEXT. 7 Oct 2026, Fabio on the rate notice
  // page: "it just sits there. you don't know if it's loading or not." The
  // portal is down to no screens answering that question with words, and
  // lib/the-portal-says-it-is-busy.test.ts keeps it there.
  if (loading) return <SkelPanel lines={6} />

  return (
    <div className="border border-[#EDE7DD] rounded-xl p-5 bg-card">
      <p className="text-[11.5px] text-faint mb-4 leading-relaxed">
        The wording of the opportunity email sent from a portfolio review. Figures are never typed
        here &mdash; the purchase price, equity release, deposit and loan come from each client&rsquo;s own
        review. The credit licence line and the estimates disclaimer stay in code: they are what makes
        this email legal to send, not wording that changes between reviews.
      </p>

      {GROUPS.map(group => (
        <div key={group} className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[.06em] text-info mb-2.5 pt-3
                        border-t border-line-soft first:border-t-0 first:pt-0">{group}</p>
          {COPY_BLOCKS.filter(b => b.group === group).map(b => {
            const text = form[b.key] ?? ''
            const def = isDefaultText(text, b)
            return (
              <div key={b.key} className="mb-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <b className="text-[12px] font-semibold text-ink">{b.label}</b>
                  <span className={`text-[9.5px] font-bold rounded-full px-2 py-[1px] border ${
                    def ? 'bg-done-bg border-done-edge text-done'
                        : 'bg-info-bg border-info-edge text-info'}`}>
                    {def ? 'default' : 'changed'}
                  </span>
                  {!def && (
                    <button onClick={() => resetOne(b.key)}
                      className="ml-auto text-[10.5px] text-info underline">Reset to default</button>
                  )}
                </div>
                <textarea
                  className={TA + (def ? '' : ' border-info-edge')}
                  rows={b.list ? 4 : Math.max(2, Math.ceil(text.length / 95))}
                  value={text}
                  onChange={e => setForm(prev => ({ ...prev, [b.key]: e.target.value }))} />
                {b.hint && <p className="text-[11px] text-faint mt-1">{b.hint}</p>}
              </div>
            )
          })}
        </div>
      ))}

      <div className="flex gap-2 items-center pt-3.5 border-t border-line-soft">
        <button className={DARK} disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save wording'}</button>
        <button className={BTN} onClick={() => setPreview(v => !v)}>
          {preview ? 'Close the preview' : 'Preview'}</button>
        <button className={BTN} onClick={resetAll}>Reset everything to default</button>
      </div>

      {said && <p className="text-[11.5px] text-done mt-2.5">{said}</p>}
      {why && <p className="text-[11.5px] text-chase mt-2.5">{why}</p>}

      {preview && (
        <>
          <p className="text-[11px] text-faint mt-3.5 mb-1.5">
            A worked example with invented figures, so the words can be read without putting a real
            client on this page.
          </p>
          <div className="border border-card-line rounded-lg overflow-hidden bg-white">
            <iframe title="The opportunity email" srcDoc={previewHtml()}
              className="w-full h-[560px] border-0" />
          </div>
        </>
      )}
    </div>
  )
}
