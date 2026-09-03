// THE HIGHLIGHTED LINE IN A MARKETING EMAIL.
//
// The same block in two campaign templates, character for character. The colours
// were constants closed over in each file, so they are arguments now - which is
// what made two copies feel necessary in the first place.
export type BlockTheme = { cyan: string; tint: string; font: string; ink: string }

export function keyBlock(line: string, payoff: string, t: BlockTheme): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr>
<td width="3" bgcolor="${t.cyan}" style="background-color:${t.cyan};width:3px;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="${t.tint}" style="background-color:${t.tint};padding:16px 18px;font-family:${t.font};">
<div style="font-size:19px;font-weight:bold;line-height:1.4;color:${t.ink};"><span style="color:${t.ink};">${line}</span></div>
<div style="font-size:14.5px;font-weight:600;color:#0B6F9E;padding-top:5px;"><span style="color:#0B6F9E;">${payoff}</span></div>
</td></tr></table>`
}
