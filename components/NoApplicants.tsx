'use client'

// A DEAL WITH NOBODY ON IT AT ALL.
//
// 10 Sep 2026, the last line of defence after Wesley Perrott - but NOT the fix
// for Wesley, and the difference matters.
//
// Wesley had an applicant the whole time. What his deal did not have was the
// Compliance tab's own COPY of that applicant list. This tab builds one from the
// fact find the first time it is opened and keeps it in compliance_data, next to
// each person's risk answers. His had never been opened, so the copy had never
// been made, and the tab reached for a list nobody had put there. shape() fixes
// that by building the copy whenever it is missing.
//
// This panel is for something rarer: a deal with nobody on it ANYWHERE - no
// applicant on the fact find either, so there is genuinely nothing to build a
// copy from.
//
// THE FACT FIND TAB ONLY. It was on the Compliance tab too for about an hour,
// and it should not have been: nothing on that tab reads the applicant while the
// page is being drawn - every read sits inside an onChange - so an empty list
// there renders an empty tab and always did. Fabio, 10 Sep 2026: "I don't see
// the point. I just want the compliance to be empty." He was right.
//
// The fact find is the one that genuinely cannot draw, because its boxes are
// wired straight to a person: `applicant.income`, the relationship dropdown, the
// address history. With nobody there, those have nothing to bind to. So this is
// a sentence in the one place the alternative is a white screen, and it is also
// the one tab where "add the client" is a useful thing to say.
//
// Nothing else on the deal is touched - the header, the documents, every other
// tab still work.

export default function NoApplicants({ tab }: { tab: string }) {
  return (
    <div className="bg-white border border-[#E6D9BC] rounded-xl p-5">
      <p className="text-[15px] font-semibold text-[#8A6A22] mb-1">
        Nobody has been added to this deal yet
      </p>
      <p className="text-[13px] text-[#7A6636] leading-relaxed mb-3">
        The {tab} tab is filled in one applicant at a time, and this deal has no applicant
        on it — not here, and not on the Fact Find. Nothing has been lost and nothing is broken;
        there is simply nobody to fill in yet.
      </p>
      <p className="text-[13px] text-[#3E4C59] leading-relaxed">
        Add the client on the <span className="font-medium">Fact Find</span> tab, then come back
        to this one. If the Fact Find <em>does</em> already show somebody, then this message is
        wrong and the portal has a fault — send a screenshot to whoever looks after it.
      </p>
    </div>
  )
}
