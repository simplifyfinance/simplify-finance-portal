'use client'

import { useState, useMemo, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  calculateRefinance,
  RefinanceInputError,
  formatCurrency,
  type RepaymentType,
  type RefinanceInput,
} from '@/lib/refinance-calculations'
import {
  buildRefinanceEmail,
  buildMailtoUrl,
  buildRefinanceSms,
} from '@/lib/refinance-email-template'
import { TONE } from '@/lib/tone'

// The email goes out in a broker's name, and anyone on the team may be the one
// sending it — so the broker is chosen, not assumed from who is logged in. Name
// and Calendly come from public.brokers, the one record that holds them, so a
// link changed on a profile changes here too.
//
// Everything about the client, the BCC included, is typed per send: that BCC is
// the address of the client's own deal card in SalesTrekker.

const STORAGE_KEY = 'sf_template_defaults_v3'

type Broker = { key: string; name: string; calendly: string }

export default function RefinanceTemplateForm() {
  const supabase = createSupabaseBrowser()

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [brokerKey, setBrokerKey] = useState('')
  const [calendlyOverride, setCalendlyOverride] = useState('')
  const [proceedUrl, setProceedUrl] = useState('')
  const [loaded, setLoaded] = useState(false)

  const [clientFirstName, setClientFirstName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [bcc, setBcc] = useState('')
  const [repaymentType, setRepaymentType] = useState<RepaymentType>('PI')
  const [balance, setBalance] = useState('')
  const [currentRate, setCurrentRate] = useState('')
  const [newRate, setNewRate] = useState('')
  const [remainingYears, setRemainingYears] = useState('')
  const [cashback, setCashback] = useState('0')

  const [readyUrl, setReadyUrl] = useState('')
  const [copied, setCopied] = useState<'html' | 'sms' | null>(null)
  const [copyError, setCopyError] = useState('')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.brokerKey) setBrokerKey(String(d.brokerKey))
        if (d.proceedUrl) setProceedUrl(String(d.proceedUrl))
      }
    } catch { /* corrupt storage is not worth failing the page over */ }
    setLoaded(true)
  }, [])

  // Every active broker, so Fabio can send as Kylie and the client still books
  // into Kylie's calendar. Defaults to whoever is logged in, when that is a broker.
  useEffect(() => {
    if (!loaded) return
    ;(async () => {
      const { data: rows } = await supabase.from('brokers')
        .select('broker_key, name, calendly, active').order('name')
      const list: Broker[] = (rows || [])
        .filter((r: any) => r.active !== false)
        .map((r: any) => ({
          key: String(r.broker_key).toLowerCase(),
          name: r.name || r.broker_key,
          calendly: r.calendly || '',
        }))
      setBrokers(list)
      if (brokerKey) return
      const { data: u } = await supabase.auth.getUser()
      if (u?.user) {
        const { data: prof } = await supabase.from('user_profiles')
          .select('broker_key').eq('id', u.user.id).maybeSingle()
        const mine = String((prof as any)?.broker_key || '').toLowerCase()
        if (mine && list.some(b => b.key === mine)) { setBrokerKey(mine); return }
      }
      if (list.length) setBrokerKey(list[0].key)
    })()
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ brokerKey, proceedUrl }))
    } catch { /* ignore */ }
  }, [brokerKey, proceedUrl, loaded])

  // A broker with no Calendly on file can still send — the link is typed here
  // for this email only, rather than the send being blocked.
  const broker = brokers.find(b => b.key === brokerKey) || null
  const calendlyUrl = calendlyOverride.trim() || broker?.calendly || ''
  useEffect(() => setCalendlyOverride(''), [brokerKey])

  const input: RefinanceInput | null = useMemo(() => {
    const b = parseFloat(balance.replace(/[^0-9.]/g, ''))
    const cr = parseFloat(currentRate)
    const nr = parseFloat(newRate)
    const ry = parseFloat(remainingYears)
    const cb = parseFloat((cashback || '0').replace(/[^0-9.]/g, ''))
    if ([b, cr, nr, ry, cb].some(n => !Number.isFinite(n))) return null
    return { balance: b, currentRate: cr, newRate: nr, repaymentType, remainingYears: ry, cashback: cb }
  }, [balance, currentRate, newRate, remainingYears, cashback, repaymentType])

  const { result, error } = useMemo(() => {
    if (!input) return { result: null, error: '' }
    try {
      return { result: calculateRefinance(input), error: '' }
    } catch (e) {
      if (e instanceof RefinanceInputError) return { result: null, error: e.message }
      return { result: null, error: 'Could not calculate — check the figures' }
    }
  }, [input])

  // The "get started" link is signed on the server — the secret must not reach
  // the browser — and carries the client, the broker and the quoted figures, so
  // nothing has to be stored anywhere.
  useEffect(() => {
    if (!input || !result || !broker || !clientEmail.trim() || !clientFirstName.trim()) {
      setReadyUrl('')
      return
    }
    const body = {
      name: clientFirstName.trim(),
      email: clientEmail.trim(),
      brokerKey: broker.key,
      brokerName: broker.name,
      calendly: calendlyUrl,
      sentOn: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
      repaymentType: input.repaymentType,
      balance: input.balance,
      currentRate: input.currentRate,
      newRate: input.newRate,
      remainingYears: input.remainingYears,
      cashback: input.cashback,
      monthlySaving: result.monthlySaving,
    }
    let live = true
    const t = setTimeout(() => {
      fetch('/api/ready-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
        .then(r => r.ok ? r.json() : null)
        .then(j => { if (live && j?.url) setReadyUrl(j.url) })
        .catch(() => { /* the Calendly link stands in, so the button is never dead */ })
    }, 400)
    return () => { live = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, result, broker, calendlyUrl, clientFirstName, clientEmail])

  const email = useMemo(() => {
    if (!input || !result) return null
    return buildRefinanceEmail(input, {
      clientFirstName,
      brokerName: broker?.name || 'Simplify Finance',
      calendlyUrl: calendlyUrl || '#',
      proceedUrl: proceedUrl.trim() || readyUrl || calendlyUrl || '#',
    })
  }, [input, result, clientFirstName, broker, calendlyUrl, proceedUrl, readyUrl])

  const missing: string[] = []
  if (!clientFirstName.trim()) missing.push('client name')
  if (!clientEmail.trim()) missing.push('client email')
  if (!broker) missing.push('a broker')
  if (!calendlyUrl.trim()) missing.push('a Calendly link')
  const ready = Boolean(email) && missing.length === 0

  // Both formats, and the ClipboardItem built inside the handler — Safari
  // rejects one constructed after an await.
  const copyHtml = async () => {
    if (!email) return
    setCopyError('')
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([email.html], { type: 'text/html' }),
        'text/plain': new Blob([email.plainText], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
      setCopied('html')
      setTimeout(() => setCopied(null), 2500)
    } catch {
      setCopyError('Copy failed — your browser may be blocking clipboard access. Try Chrome.')
    }
  }

  const copySms = async () => {
    if (!input) return
    setCopyError('')
    try {
      await navigator.clipboard.writeText(buildRefinanceSms(input, {
        clientFirstName,
        brokerName: broker?.name || 'Simplify Finance',
        calendlyUrl,
        proceedUrl: proceedUrl.trim() || calendlyUrl,
      }))
      setCopied('sms')
      setTimeout(() => setCopied(null), 2500)
    } catch {
      setCopyError('Copy failed — try Chrome.')
    }
  }

  const openMail = () => {
    if (!email) return
    window.location.href = buildMailtoUrl({ to: clientEmail, bcc, subject: email.subject })
  }

  const panel = 'bg-white border rounded-xl px-4 py-4 mb-3.5'
  const pS = { borderColor: TONE.line }
  const h3 = 'text-[11px] font-bold tracking-[.08em] uppercase mb-3'
  const lab = 'text-[11.5px] mb-1 block'
  const inp = 'w-full border rounded-lg px-2.5 py-[7px] text-[13px] bg-white outline-none focus:border-[#0E8FCB]'
  const inpS = { borderColor: TONE.line, color: TONE.ink }
  const hint = 'text-[11px] mt-1'

  return (
    <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
      <div>
        <div className={panel} style={pS}>
          <h3 className={h3} style={{ color: TONE.label }}>Sending as</h3>
          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <div>
              <label className={lab} style={{ color: TONE.label }}>Broker</label>
              <select className={inp} style={inpS} value={brokerKey}
                      onChange={e => setBrokerKey(e.target.value)}>
                {brokers.length === 0 && <option value="">Loading…</option>}
                {brokers.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
              </select>
              <p className={hint} style={{ color: TONE.faint }}>
                The email is signed by this broker and books into their calendar.
              </p>
            </div>
            <div>
              <label className={lab} style={{ color: TONE.label }}>Calendly link</label>
              <input className={inp} style={inpS} value={calendlyUrl}
                     onChange={e => setCalendlyOverride(e.target.value)}
                     placeholder="https://calendly.com/..." />
              <p className={hint} style={{ color: broker?.calendly ? TONE.faint : TONE.neg }}>
                {broker?.calendly
                  ? 'From their broker profile. Change it here for this email only.'
                  : 'No Calendly on their profile — add one in Settings, or type it for this email.'}
              </p>
            </div>
            <div className="col-span-2 max-[520px]:col-span-1">
              <label className={lab} style={{ color: TONE.label }}>“Get started” link</label>
              <input className={inp} style={inpS} value={proceedUrl}
                     onChange={e => setProceedUrl(e.target.value)}
                     placeholder={readyUrl ? 'Using the next-steps page' : 'Leave blank to use the Calendly link'} />
              <p className={hint} style={{ color: readyUrl ? TONE.pos : TONE.faint }}>
                {proceedUrl.trim()
                  ? 'Your link is being used instead of the next-steps page.'
                  : readyUrl
                    ? 'Points at the next-steps page. Pressing it tells you they are ready.'
                    : 'Fill in the client and the figures and the next-steps page is used automatically.'}
              </p>
            </div>
          </div>
        </div>

        <div className={panel} style={pS}>
          <h3 className={h3} style={{ color: TONE.label }}>Client</h3>
          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <div>
              <label className={lab} style={{ color: TONE.label }}>First name</label>
              <input className={inp} style={inpS} value={clientFirstName}
                     onChange={e => setClientFirstName(e.target.value)} placeholder="Sarah" />
            </div>
            <div>
              <label className={lab} style={{ color: TONE.label }}>Email</label>
              <input className={inp} style={inpS} value={clientEmail} type="email"
                     onChange={e => setClientEmail(e.target.value)} placeholder="sarah@example.com" />
            </div>
            <div className="col-span-2 max-[520px]:col-span-1">
              <label className={lab} style={{ color: TONE.label }}>SalesTrekker BCC</label>
              <input className={inp} style={inpS} value={bcc}
                     onChange={e => setBcc(e.target.value)} placeholder="The address on this client's deal card" />
              <p className={hint} style={{ color: TONE.faint }}>
                Specific to this deal card. Without it the send is not logged against the client.
              </p>
            </div>
          </div>
        </div>

        <div className={panel} style={pS}>
          <h3 className={h3} style={{ color: TONE.label }}>Loan</h3>
          <div className="inline-flex rounded-lg p-[2px] border mb-3"
               style={{ background: TONE.hair, borderColor: TONE.line }}>
            {([['PI', 'Principal & interest'], ['IO', 'Interest only']] as const).map(([id, l]) => (
              <button key={id} onClick={() => setRepaymentType(id as RepaymentType)}
                className="px-3 py-1 text-[12.5px] rounded-[6px]"
                style={repaymentType === id
                  ? { background: '#fff', color: TONE.ink, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.07)' }
                  : { color: TONE.body }}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <div><label className={lab} style={{ color: TONE.label }}>Current balance</label>
              <input className={inp} style={inpS} value={balance} inputMode="decimal"
                     onChange={e => setBalance(e.target.value)} placeholder="640000" /></div>
            <div><label className={lab} style={{ color: TONE.label }}>Remaining term (years)</label>
              <input className={inp} style={inpS} value={remainingYears} inputMode="decimal"
                     onChange={e => setRemainingYears(e.target.value)} placeholder="27" /></div>
            <div><label className={lab} style={{ color: TONE.label }}>Current rate %</label>
              <input className={inp} style={inpS} value={currentRate} inputMode="decimal"
                     onChange={e => setCurrentRate(e.target.value)} placeholder="6.29" /></div>
            <div><label className={lab} style={{ color: TONE.label }}>New rate %</label>
              <input className={inp} style={inpS} value={newRate} inputMode="decimal"
                     onChange={e => setNewRate(e.target.value)} placeholder="5.64" /></div>
            <div><label className={lab} style={{ color: TONE.label }}>Cashback</label>
              <input className={inp} style={inpS} value={cashback} inputMode="decimal"
                     onChange={e => setCashback(e.target.value)} placeholder="0" />
              <p className={hint} style={{ color: TONE.faint }}>Leave at 0 if none is on offer.</p></div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-3.5 text-[12.5px] border"
               style={{ background: '#FBEDE9', borderColor: '#EFCFC5', color: '#9C3A20' }}>{error}</div>
        )}

        {result && (
          <div className="rounded-xl px-4 py-3 mb-3.5 border flex items-baseline gap-3 flex-wrap"
               style={{ background: TONE.zebra, borderColor: TONE.line }}>
            <span className="text-[23px] font-[660] tracking-[-.02em]" style={{ color: TONE.ink }}>
              {formatCurrency(result.monthlySaving)} a month
            </span>
            <span className="text-[12px]" style={{ color: TONE.label }}>
              {formatCurrency(result.annualSaving)} a year · {formatCurrency(result.periodSaving)} over the term
              {result.monthsSavedIfRepaymentsHeld
                ? ` · ${Math.floor(result.monthsSavedIfRepaymentsHeld / 12)} yrs ${result.monthsSavedIfRepaymentsHeld % 12} mths sooner`
                : ''}
            </span>
          </div>
        )}

        <div className="flex gap-2.5 items-center flex-wrap">
          <button onClick={copyHtml} disabled={!ready}
            className="rounded-lg px-4 py-[9px] text-[13px] font-semibold disabled:opacity-40"
            style={{ background: TONE.accent, color: '#fff' }}>
            {copied === 'html' ? 'Copied' : 'Copy email'}
          </button>
          <button onClick={openMail} disabled={!ready}
            className="rounded-lg px-4 py-[9px] text-[13px] font-medium border disabled:opacity-40"
            style={{ borderColor: TONE.line, color: TONE.ink, background: '#fff' }}>Open in mail</button>
          <button onClick={copySms} disabled={!input}
            className="rounded-lg px-4 py-[9px] text-[13px] font-medium border disabled:opacity-40"
            style={{ borderColor: TONE.line, color: TONE.ink, background: '#fff' }}>
            {copied === 'sms' ? 'Copied' : 'Copy SMS'}
          </button>
          {missing.length > 0 && (
            <span className="text-[11.5px]" style={{ color: TONE.faint }}>Still needs {missing.join(', ')}</span>
          )}
        </div>

        {copyError && <p className="text-[12px] mt-2" style={{ color: TONE.neg }}>{copyError}</p>}

        <p className="text-[11.5px] mt-2.5" style={{ color: TONE.label }}>
          A mail link cannot carry a formatted body — that is the standard, not a gap here. Copy the email, press
          Open in mail, then paste into the message that opens with the address, BCC and subject already filled.
        </p>
      </div>

      <div>
        <div className="text-[11px] font-bold tracking-[.08em] uppercase mb-2" style={{ color: TONE.label }}>
          What the client receives
        </div>
        {email ? (
          <>
            <div className="rounded-xl border px-3 py-2 mb-2.5 text-[12.5px]"
                 style={{ borderColor: TONE.line, background: '#fff', color: TONE.body }}>
              <span style={{ color: TONE.label }}>Subject</span>{' '}
              <span style={{ color: TONE.ink, fontWeight: 520 }}>{email.subject}</span>
            </div>
            <div className="rounded-xl border overflow-auto"
                 style={{ borderColor: TONE.line, background: '#f5f5f3', maxHeight: '78vh' }}
                 dangerouslySetInnerHTML={{ __html: email.html }} />
          </>
        ) : (
          <div className="rounded-xl border px-4 py-8 text-[13px] text-center"
               style={{ borderColor: TONE.line, background: '#fff', color: TONE.faint }}>
            Fill in the loan figures and the email appears here.
          </div>
        )}
      </div>
    </div>
  )
}
