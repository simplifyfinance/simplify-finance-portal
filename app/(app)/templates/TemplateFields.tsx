'use client'
import { TONE } from '@/lib/tone'
import type { Broker } from './useSender'

// The two panels every template shares: who it comes from, and who it goes to.
// The BCC is typed per send because it belongs to that client's own deal card in
// SalesTrekker, not to the person sending.

export const inp = 'w-full border rounded-lg px-2.5 py-[7px] text-[13px] bg-white outline-none focus:border-[#0E8FCB]'
export const inpS = { borderColor: TONE.line, color: TONE.ink }
export const panel = 'bg-white border rounded-xl px-4 py-4 mb-3.5'
export const panelS = { borderColor: TONE.line }
const h3 = 'text-[11px] font-bold tracking-[.08em] uppercase mb-3'
const lab = 'text-[11.5px] mb-1 block'
const hint = 'text-[11px] mt-1'

export function SenderPanel({
  brokers, brokerKey, setBrokerKey, broker, calendlyUrl, setCalendlyOverride,
  brands, brandId, setBrandId,
}: {
  brokers: Broker[]
  brokerKey: string
  setBrokerKey: (v: string) => void
  broker: Broker | null
  calendlyUrl: string
  setCalendlyOverride: (v: string) => void
  brands?: { id: string; name: string }[]
  brandId?: string
  setBrandId?: (v: string) => void
}) {
  return (
    <div className={panel} style={panelS}>
      <h3 className={h3} style={{ color: TONE.label }}>Sending as</h3>
      <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
        <div>
          <label className={lab} style={{ color: TONE.label }}>Broker</label>
          <select className={inp} style={inpS} value={brokerKey} onChange={e => setBrokerKey(e.target.value)}>
            {brokers.length === 0 && <option value="">Loading…</option>}
            {brokers.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
          </select>
          <p className={hint} style={{ color: TONE.faint }}>
            Signs the email and takes the bookings.
          </p>
        </div>
        {/* Always shown. Hiding it when a broker had only one brand meant the
            control simply was not there, with nothing to say why. */}
        {brands && brands.length > 0 && setBrandId && (
          <div>
            <label className={lab} style={{ color: TONE.label }}>Brand</label>
            <select className={inp} style={inpS} value={brandId || ''} onChange={e => setBrandId(e.target.value)}>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <p className={hint} style={{ color: TONE.faint }}>
              {brands.length > 1
                ? 'Sets the logo, the header colour and the licence in the footer.'
                : 'The only brand on this broker\u2019s profile. Add more in Settings, Brokers.'}
            </p>
          </div>
        )}
        <div>
          <label className={lab} style={{ color: TONE.label }}>Calendly link</label>
          <input className={inp} style={inpS} value={calendlyUrl}
                 onChange={e => setCalendlyOverride(e.target.value)} placeholder="https://calendly.com/..." />
          <p className={hint} style={{ color: broker?.calendly ? TONE.faint : TONE.neg }}>
            {broker?.calendly
              ? 'From their broker profile. Change it here for this email only.'
              : 'No Calendly on their profile — add one in Settings, or type it for this email.'}
          </p>
        </div>
      </div>
    </div>
  )
}

export function ClientPanel({
  firstName, setFirstName, email, setEmail,
  joint, setJoint, secondName, setSecondName, secondEmail, setSecondEmail,
  bcc, setBcc,
}: {
  firstName: string; setFirstName: (v: string) => void
  email: string; setEmail: (v: string) => void
  joint: boolean; setJoint: (v: boolean) => void
  secondName: string; setSecondName: (v: string) => void
  secondEmail: string; setSecondEmail: (v: string) => void
  bcc: string; setBcc: (v: string) => void
}) {
  return (
    <div className={panel} style={panelS}>
      <h3 className={h3} style={{ color: TONE.label }}>Client</h3>
      <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
        <div>
          <label className={lab} style={{ color: TONE.label }}>First name</label>
          <input className={inp} style={inpS} value={firstName}
                 onChange={e => setFirstName(e.target.value)} placeholder="Sarah" />
        </div>
        <div>
          <label className={lab} style={{ color: TONE.label }}>Email</label>
          <input className={inp} style={inpS} value={email} type="email"
                 onChange={e => setEmail(e.target.value)} placeholder="sarah@example.com" />
        </div>
        <div className="col-span-2 max-[520px]:col-span-1">
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: TONE.body }}>
            <input type="checkbox" checked={joint} onChange={e => setJoint(e.target.checked)} />
            There are two applicants
          </label>
        </div>
        {joint && (
          <>
            <div>
              <label className={lab} style={{ color: TONE.label }}>Second first name</label>
              <input className={inp} style={inpS} value={secondName}
                     onChange={e => setSecondName(e.target.value)} placeholder="Andrew" />
            </div>
            <div>
              <label className={lab} style={{ color: TONE.label }}>Second email</label>
              <input className={inp} style={inpS} value={secondEmail} type="email"
                     onChange={e => setSecondEmail(e.target.value)} placeholder="andrew@example.com" />
              <p className={hint} style={{ color: TONE.faint }}>Both are put on the To line.</p>
            </div>
          </>
        )}
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
  )
}
