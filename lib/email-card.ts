// THE CREAM CARD, AND A ROW INSIDE IT. ONE COPY.
//
// 7 Oct 2026. These two lived inside app/api/generate-email/route.ts. The LO
// email needed the same card, I wrote it out a second time, and
// lib/no-duplicate-logic.test.ts refused the ship with the right words:
//
//   "The same function body appears in more than one file. A fix applied to one
//    copy is not a fix - that is how self-employed income stayed at $0 for five
//    weeks. Move it into lib/ and import it in both places."
//
// So here they are, and both routes import them.
//
// WHY THE MARKUP LOOKS LIKE 2004. Outlook on Windows renders mail through Word,
// which paints a background only from a bgcolor ATTRIBUTE on a <td> or <table> -
// a CSS background on a div shows nothing - and drops a text colour set on a
// paragraph, so every piece of text is wrapped in a <span> carrying its own
// colour. scripts/check-email-html.sh fails the ship if either rule is broken.
// Nothing here is to be "tidied up" into modern CSS.

export function card(title: string, rows: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
    <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px"><span style="color:#7a5c3a;">${title}</span></p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr></table>`
}

export function row(l: string, v: string) {
  return `<tr><td style="font-size:12px;color:#555;padding:3px 0"><span style="color:#555;">${l}</span></td><td style="font-size:12px;color:#343333;font-weight:500;text-align:right"><span style="color:#343333;">${v}</span></td></tr>`
}
