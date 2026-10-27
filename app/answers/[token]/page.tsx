import { loadAnswers } from '@/lib/answers-flow'
import AnswersForm from './AnswersForm'
import { save } from './actions'

// A FEW THINGS YOUR BROKER STILL NEEDS.
//
// 27 Oct 2026. The fourth page a client opens without a login, after Proceed,
// Ready and Opportunity. Everything load-bearing is in lib/answers-flow.ts and
// the note at the top of it is the one to read.
//
// NO LOGIN, NO PASSWORD, NOTHING TO SET UP. The link is signed and carries the
// deal and a four-week expiry inside itself - Fabio, 27 Oct 2026: "Link expires
// in 4 weeks."
export default async function AnswersPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const view = await loadAnswers(token)

  if (!view.ok) {
    return (
      <Shell>
        <h1 style={H1}>{view.why === 'expired' ? 'This link has expired' : 'This link does not work'}</h1>
        <p style={P}>
          {view.why === 'expired'
            ? 'Links last four weeks. Reply to the last email you had from us and we will send a new one.'
            : 'Check you have the whole link from the email, or just reply to it and we will sort it out.'}
        </p>
      </Shell>
    )
  }

  // NOTHING OUTSTANDING IS A THANK YOU, NOT AN EMPTY FORM.
  //
  // A client who answers two, comes back a week later and finds four empty
  // boxes has no idea whether the first two arrived.
  if (!view.questions.length) {
    return (
      <Shell>
        <h1 style={H1}>Nothing outstanding{view.firstName ? `, ${view.firstName}` : ''}</h1>
        <p style={P}>
          We have everything we need from you. If anything changes, just reply to the email.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 style={H1}>
        A few things {view.brokerName || 'we'} still need{view.firstName ? `, ${view.firstName}` : ''}
      </h1>
      <p style={P}>
        About a minute. Nothing is saved until you press the button at the bottom.
      </p>
      <AnswersForm token={token} questions={view.questions} onSave={save} />
    </Shell>
  )
}

const H1: React.CSSProperties = {
  fontSize: 23, fontWeight: 700, color: '#17140F', margin: '0 0 8px', lineHeight: 1.3,
}
const P: React.CSSProperties = {
  fontSize: 14.5, color: '#6F6A62', margin: '0 0 20px', lineHeight: 1.6,
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F7F4EF', padding: '34px 18px' }}>
      <div style={{
        maxWidth: 680, margin: '0 auto', background: '#FFFFFF', border: '1px solid #EBE5DB',
        borderRadius: 14, padding: '26px 24px',
      }}>
        {children}
      </div>
    </div>
  )
}
