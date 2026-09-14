// THE HTML OF THE CLIENT'S "WHAT HAPPENS NEXT" EMAIL.
//
// Lifted out of the route on 11 Sep 2026 so that the exact bytes that get sent
// can be read by a test without sending anything. The route builds its email by
// calling this and nothing else, so a robot checking this is checking the real
// email, not a copy of it that can drift.
//
// Tables, not flex. Word ignores display:flex and border-radius entirely, so the
// numbered steps collapsed into a stack of loose text in Outlook on Windows.
// Every colour sits on a cell as a bgcolor attribute for the same reason - Word
// paints nothing from CSS alone.

import { buildNextStepsContent, type ProceedStage } from './next-steps-copy'

const esc = (v: any) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildNextStepsEmailHtml(opts: {
  stage: ProceedStage
  clientName?: string | null
  wealthDeskLink?: string
}): string {
  const { steps } = buildNextStepsContent(opts.stage, opts.wealthDeskLink)
  const clientName = esc(opts.clientName || 'there')
  const link = esc(opts.wealthDeskLink || '')

  const stepsHtml = steps.map(s => {
    const badge = s.accent ? '#1D9E75' : '#343333'
    const button = s.button
      ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px"><tr>
           <td bgcolor="#1D9E75" align="center" style="background:#1D9E75;border-radius:6px;padding:8px 14px">
             <a href="${link}" style="color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;display:inline-block">Click here to share your bank statements</a>
           </td></tr></table>`
      : ''
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
      <td width="34" valign="top" style="width:34px">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="24" height="24" bgcolor="${badge}" align="center" valign="middle"
              style="width:24px;height:24px;background:${badge};border-radius:12px;color:#ffffff;font-size:11px;font-weight:700;font-family:Arial,sans-serif">${s.num}</td>
        </tr></table>
      </td>
      <td valign="top" style="font-family:Arial,sans-serif">
        <p style="margin:0 0 4px;font-weight:700;color:#343333;font-size:13px"><span style="color:#343333;">${s.title}</span></p>
        <p style="margin:0;color:#666666;font-size:12px;line-height:1.6"><span style="color:#666666;">${s.desc}</span></p>
        ${button}
      </td>
    </tr></table>`
  }).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;font-family:Arial,sans-serif">
    <tr><td bgcolor="#F2E8DB" align="center" style="background:#F2E8DB;padding:24px 12px">
      <table width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" align="center" style="background:#ffffff;border-radius:16px;max-width:480px">
        <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:36px">
          <h1 style="font-size:20px;font-weight:700;color:#343333;margin:0 0 8px">Great news, ${clientName}!</h1>
          <p style="font-size:13px;color:#666666;margin:0 0 24px;line-height:1.6"><span style="color:#666666;">Following our call, here&rsquo;s exactly what happens next.</span></p>
          ${stepsHtml}
          <p style="font-size:11px;color:#999999;margin:16px 0 0;border-top:1px solid #eeeeee;padding-top:16px"><span style="color:#999999;">Simplify Finance | ACL 387025 | St Leonards, Sydney</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>`
}
