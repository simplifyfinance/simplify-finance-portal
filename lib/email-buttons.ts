// THE TWO BUTTONS AT THE END OF A CLIENT EMAIL.
//
// Written out identically in both email generators. The comment inside explains
// a real Outlook bug that was found and fixed once - in one of the two copies
// it appeared in, which is exactly how a fix stops being a fix. See
// lib/no-duplicate-logic.test.ts.
export function ctas(calendly: string, proceedUrl?: string) {
  // The colour has to live on the cell, not the link. Word paints a cell
  // background and ignores one on an inline anchor, which is why these arrived
  // as bare blue text in Outlook on Windows.
  const button = (href: string, bg: string, label: string) =>
    `<table cellpadding="0" cellspacing="0" border="0" style="display:inline-table"><tr>
      <td bgcolor="${bg}" align="center" style="background:${bg};border-radius:6px;padding:10px 18px">
        <a href="${href}" style="color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">${label}</a>
      </td></tr></table>`
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px"><tr>
    <td>${button(proceedUrl || calendly, '#2DBEFF', 'I am ready to proceed')}</td>
    <td width="10">&nbsp;</td>
    <td>${button(calendly, '#343333', 'Book a call')}</td>
  </tr></table>`
}
