'use client'
import { conflictMessage } from '@/lib/save-conflict'

// The same banner on all four tabs. One wording, so BC, Fact Find, Lending
// options and Compliance cannot drift into saying different things about the
// same situation. See lib/save-conflict.ts for why this exists.
//
// It appears far less often than it used to. Two people working different parts
// of the same tab are merged and never see it; this is now only for the same
// field, changed by both, to different things - which is why it can name the
// field, and why it is worth reading when it does appear.
export default function SaveConflict({ tab, fields }: { tab: string; fields: string | null }) {
  if (fields === null) return null
  const { title, body } = conflictMessage(tab, fields)
  return (
    <div className="border-2 border-[#C4553B] bg-[#FDF2F0] rounded-xl px-4 py-3.5 mb-4">
      <h4 className="m-0 mb-1 text-[13.5px] font-bold text-[#6E2A20]">{title}</h4>
      <p className="m-0 text-[12.5px] leading-[1.6] text-[#8A3A2E]">{body}</p>
      <button onClick={() => window.location.reload()}
        className="mt-2.5 bg-[#C4553B] text-white rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold hover:bg-[#a8492f] transition">
        Reload this deal
      </button>
    </div>
  )
}
