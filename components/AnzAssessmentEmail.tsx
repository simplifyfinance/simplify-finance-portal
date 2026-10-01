"use client"
import { showAnzAssessmentButton, assessmentSubject, assessmentMailto, ANZ_ASSESSMENT_TO }
  from '@/lib/anz-assessment'

// ABOVE THE TABS AND OUTSIDE THE LOCK, beside the documents and the client
// emails. Writing to an assessor is something you do while a deal sits with the
// lender, which is exactly when the tabs below are read only.
//
// ONLY ON AN ANZ DEAL. Every other lender has its own channel - AOL, a portal -
// and a button to ANZ on a Macquarie deal is a mistake waiting to be clicked.
export default function AnzAssessmentEmail({ deal }: { deal: any }) {
  if (!showAnzAssessmentButton(deal)) return null
  const subject = assessmentSubject(deal)

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold tracking-[.07em] uppercase text-[#A29889] mr-1">ANZ</span>
        <a href={assessmentMailto(deal)}
          className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5">
          Email the assessment team
          <span className="text-[11px] text-[#A29889]">{ANZ_ASSESSMENT_TO}</span>
        </a>
        {subject
          ? <span className="text-[11px] text-[#A29889]">Subject: {subject}</span>
          : /* THE BOX THAT IS EMPTY, AND WHERE IT IS. The email still opens -
               opening one is never blocked - but the assessor has nothing to
               search on until somebody records the reference. */
            <span className="text-[11px] text-[#8A6218]">
              No ANZ Application ID recorded, so the subject will be empty &mdash; add it under Settlement.
            </span>}
      </div>
    </div>
  )
}
