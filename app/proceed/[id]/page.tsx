import { notFound } from 'next/navigation'
import { loadProceed, stageFor, hasProceeded, buildNextStepsContent } from '@/lib/proceed-flow'
import { confirmProceed, confirmOnArrival, requestCall } from './actions'
import { optionFromLink } from '@/lib/bc-scenarios'
import { choiceFromLink } from '@/lib/client-lender-choice'
import ProceedButton from './ProceedButton'
import ConfirmedPanel from './ConfirmedPanel'
import TalkFirstPanel from './TalkFirstPanel'

// Opening this page reads the deal and nothing more. Until the client presses
// the button, no stage moves, no credit officer is allocated and nobody is
// emailed — which is what used to happen every time a mail scanner followed the
// link on its way to the inbox.
//
// 19 OCT 2026, AND READ THE PARAGRAPH ABOVE BEFORE THIS ONE.
//
// A Lending Options link now carries which of two buttons the client pressed in
// the email — go ahead with the recommended bank, or ask to talk it through —
// and on those links there is no button on this page: the client has answered
// already. The write still does not hang off the link. It is made by the
// rendered page from the browser, which a scanner does not do. See
// RecordOnLoad.tsx and actions.ts for the whole of why that is not a return of
// the August bug.
//
// EVERY LINK WITHOUT A CHOICE BEHAVES EXACTLY AS IT DID. Borrowing Capacity
// emails, and every Lending Options email already sitting in a client's inbox,
// still land on the button. Nothing already sent changes meaning.
export default async function ProceedPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; opt?: string; choice?: string }> }) {
  const { id } = await params
  const { from, opt, choice: rawChoice } = await searchParams

  const result = await loadProceed(id)
  if (!result.ok) return notFound()

  const { deal, wealthDeskLink } = result
  const stage = stageFor(deal, from)
  const done = hasProceeded(deal, stage)
  // TRIMMED, BECAUSE THE NAME COMES FROM A BOX SOMEBODY TYPED IN.
  //
  // 23 Sep 2026: a trailing space on a first name printed "Ready to go ahead,
  // Hameed ?" and "Great news, Hameed !" - the space is invisible in the
  // database and obvious on the client's screen. Fixed here rather than in the
  // data, because the next name typed with a space would do it again.
  const clientName = String(deal.clients?.first_name || '').trim() || 'there'
  const { heading, steps } = buildNextStepsContent(stage, wealthDeskLink)

  // WHICH BUTTON THEY PRESSED, checked into one of two words we chose before it
  // decides anything - see lib/client-lender-choice.ts. Only ever honoured on
  // Lending Options; a Borrowing Capacity link carrying one is ignored rather
  // than obeyed.
  const choice = stage === 'LO' ? choiceFromLink(rawChoice) : null
  // THE BANK IS NOT READ HERE. It comes back from the write that records it -
  // see ConfirmedPanel.tsx, and the note on the select in loadProceed for why
  // this page does not hold the lending options record. The column below is a
  // plain one, and is used only to word a link back, never to tell a client
  // what is happening to their application.
  const alreadyNamed = String((deal as any).lo_proceeded_lender || '').trim()

  // Bound to this deal and this step, then handed to the button. The button is
  // a client component so it can say "just a moment" while it waits and show a
  // sentence if it fails - see ProceedButton.tsx for why that matters.
  // WHICH OF THE TWO THEY PRESSED, OFF A URL ANYBODY CAN EDIT.
  //
  // Checked into 1, 2 or nothing before it is used for anything. It is never
  // printed as text - only ever as the word "Option" and a digit we chose - so
  // there is nothing here to put somebody else's words on this page.
  const option = optionFromLink(opt)
  const submit = confirmProceed.bind(null, id, stage, option)
  const recordArrival = confirmOnArrival.bind(null, id, stage)
  const askForCall = requestCall.bind(null, id)

  const card = (children: React.ReactNode) => (
    <div style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#F2E8DB', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '40px', maxWidth: '480px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {children}
        <div style={{ borderTop: '1px solid #eee', marginTop: '24px', paddingTop: '14px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#999' }}>Simplify Finance | ACL 387025 | St Leonards, Sydney</p>
        </div>
      </div>
    </div>
  )

  const crest = (glyph: string, colour: string, ink: string) => (
    <div style={{ width: '56px', height: '56px', backgroundColor: colour, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '22px', color: ink, fontWeight: 'bold' }}>{glyph}</div>
  )

  const stepList = (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: '13px', top: '30px', bottom: '30px', width: '2px', backgroundColor: '#e0e0e0' }} />
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: i < steps.length - 1 ? '24px' : 0, position: 'relative' }}>
          <div style={{ width: '27px', height: '27px', borderRadius: '50%', backgroundColor: step.accent ? '#1D9E75' : '#343333', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0, zIndex: 1 }}>{step.num}</div>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#343333', fontSize: '14px' }}>{step.title}</p>
            <p style={{ margin: step.button ? '0 0 10px' : 0, color: '#666', fontSize: '12.5px', lineHeight: '1.6' }}>{step.desc}</p>
            {step.button && (
              <a href={wealthDeskLink} style={{ backgroundColor: '#1D9E75', color: '#fff', padding: '9px 16px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>Click here to share your bank statements</a>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // ---------------------------------------------------------------------
  // THEY PRESSED "PROCEED WITH <BANK>" IN THE EMAIL.
  //
  // No button here - they have answered already. The panel records it from the
  // browser once the page is on screen and then says which bank it recorded.
  // ---------------------------------------------------------------------
  if (choice === 'proceed') {
    return card(
      <ConfirmedPanel action={recordArrival} clientName={clientName}>
        {stepList}
        {/* THE HONEST ESCAPE HATCH, and the difference between a page that
            records itself and a link that records itself. A client who did not
            mean to press it can say so, which flags the deal and emails the
            broker - see markWantsCall. It does not undo their agreement; that
            is a broker's call once they have spoken to them. */}
        <div style={{ borderTop: '1px solid #eee', marginTop: '24px', paddingTop: '14px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '11.5px', color: '#8A8278', lineHeight: 1.6 }}>
            Pressed this by mistake?{' '}
            <a href={`/proceed/${id}?from=LO&choice=talk`} style={{ color: '#107EA8', textDecoration: 'underline' }}>Let us know</a>{' '}
            and we will hold off.
          </p>
        </div>
      </ConfirmedPanel>
    )
  }

  // ---------------------------------------------------------------------
  // THEY PRESSED "I'D RATHER TALK IT THROUGH FIRST".
  // ---------------------------------------------------------------------
  if (choice === 'talk') {
    return card(
      <TalkFirstPanel
        action={askForCall}
        clientName={clientName}
        lenderName={alreadyNamed}
        backHref={`/proceed/${id}?from=LO&choice=proceed`}
      />
    )
  }

  // ---------------------------------------------------------------------
  // EVERY OTHER LINK - Borrowing Capacity, and Lending Options emails sent
  // before 19 Oct 2026. Unchanged, down to the button.
  // ---------------------------------------------------------------------
  return card(
    <>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        {crest(done ? '✓' : '→', '#4FBBEA', '#0F1115')}
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#343333', margin: '0 0 6px' }}>
          {done ? `Great news, ${clientName}!` : `Ready to go ahead, ${clientName}?`}
        </h1>
        <p style={{ fontSize: '13px', color: '#666', margin: 0, lineHeight: '1.5' }}>
          {done
            ? "We're moving your application forward. Here's exactly what happens next."
            : "Here is what happens once you confirm. Nothing moves until you press the button below."}
        </p>
        {/* WHICH ONE THEY PRESSED, SAID BACK TO THEM. A client who chose
            between two options wants to see that the right one was heard.
            The word "Option" and a digit, both ours - never the label off
            the link, which is text somebody else could have written. */}
        {option && (
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F7B4F', margin: '12px 0 0' }}>
            Option {option}
          </p>
        )}
      </div>

      {!done && <ProceedButton action={submit} />}

      {stepList}
    </>
  )
}
