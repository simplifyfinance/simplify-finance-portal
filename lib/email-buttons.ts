// THE BUTTON AT THE END OF A CLIENT EMAIL.
//
// Written out identically in both email generators. The comment inside explains
// a real Outlook bug that was found and fixed once - in one of the two copies
// it appeared in, which is exactly how a fix stops being a fix. See
// lib/no-duplicate-logic.test.ts.
//
// ONE BUTTON, NOT TWO. 15 Sep 2026.
//
// This used to be two buttons of equal weight side by side, so neither was THE
// action - a choice rather than an instruction. And the primary one was white
// text on #2DBEFF, a contrast ratio of 2.1 to 1 against the 4.5 needed to read
// comfortably, so it arrived looking like a pale wash rather than something you
// press.
//
// Fabio, 15 Sep 2026: "how do we make it obvious it is a button and they need to
// press". Four things do it, and none of them is size - he asked twice for it to
// be smaller:
//
//   1. one button. "Book a call" is now a plain underlined link underneath.
//   2. charcoal on the blue instead of white. 5.95 to 1, and it suddenly reads
//      as a solid object.
//   3. an arrow, which does more work than it looks like it should.
//   4. a line above it telling the client to press it. A button with an
//      instruction beside it gets pressed; a button on its own gets scrolled
//      past.
export function ctas(calendly: string, proceedUrl?: string) {
  // The colour has to live on the cell, not the link. Word paints a cell
  // background and ignores one on an inline anchor, which is why these arrived
  // as bare blue text in Outlook on Windows.
  //
  // The text colour has to live on the anchor for the same family of reasons -
  // Word keeps a colour on a run and drops one on a paragraph.
  const lead = `<p style="font-size:13px;font-weight:600;margin:0 0 10px;line-height:1.5">`
    + `<span style="color:#343333;">Ready to go ahead? Press the button below and we will get started.</span></p>`

  const button = `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px"><tr>
      <td bgcolor="#2DBEFF" align="center" style="background:#2DBEFF;border-radius:6px;padding:12px 22px">
        <a href="${proceedUrl || calendly}" style="color:#343333;font-size:14px;font-weight:700;text-decoration:none;display:inline-block">I am ready to proceed &nbsp;&rarr;</a>
      </td></tr></table>`

  // No colour on the paragraph itself - the anchor carries it, which is what
  // Word honours and what the email HTML check insists on.
  const call = `<p style="font-size:12px;margin:0 0 20px;line-height:1.5">`
    + `<a href="${calendly}" style="color:#343333;text-decoration:underline">Or book a call with us</a></p>`

  return lead + button + call
}
