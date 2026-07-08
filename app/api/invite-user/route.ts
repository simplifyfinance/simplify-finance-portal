import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { email, fullName, role } = await req.json()

  if (!email || !fullName || !role) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }

  const supabaseAdmin = createSupabaseAdmin()

  // Create auth user and send Supabase activation email
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Insert user profile
  const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    active: true
  })

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 })
  }

  // Send welcome email via Resend — non-fatal if it fails
  const firstName = fullName.split(' ')[0]
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to: email,
        cc: 'info@simplifyfinance.com.au',
        subject: "You're invited to the Simplify Finance Portal",
        html: `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f3;font-family:Arial,sans-serif">
            <tr><td>
              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;margin:0 auto">
                <tr><td style="background:#343333;padding:28px 24px;text-align:center">
                  <img src="https://simplify-finance-portal.vercel.app/logo-charcoal.png" alt="Simplify Finance" style="height:80px;width:auto;display:block;margin:0 auto 8px" />
                  <p style="color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0">Finance, Simplified.</p>
                </td></tr>
                <tr><td style="padding:32px 28px">
                  <p style="font-size:15px;color:#343333;margin:0 0 20px">Hi ${firstName},</p>
                  <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 16px">You've been invited to the Simplify Finance Credit &amp; Compliance Portal &mdash; our internal system for managing deals, borrowing capacity reviews, lending options, and compliance.</p>
                  <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 8px">To get set up, follow these steps:</p>
                  <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 6px">1. Check your inbox (and spam folder) for a separate email from Supabase &mdash; click the activation link inside it.</p>
                  <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 6px">2. Once you've clicked that link, go to: <a href="https://simplify-finance-portal.vercel.app/login" style="color:#2DBEFF">simplify-finance-portal.vercel.app/login</a></p>
                  <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 6px">3. Click <strong>Forgot password?</strong>, enter your email address, and follow the prompts to set your own password.</p>
                  <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 24px">4. Log in &mdash; your access and permissions are already set up.</p>
                  <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 24px">If you have any trouble, reply to this email and I'll help you out.</p>
                  <p style="font-size:14px;color:#333;margin:0">Welcome to the team portal!</p>
                  <div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;max-width:240px;margin-top:24px">
                    <p style="font-size:14px;font-weight:600;color:#333;margin:0 0 2px">Fabio de Castro</p>
                    <p style="font-size:12px;color:#666;margin:0 0 2px">Director / Mortgage Broker</p>
                    <p style="font-size:11px;color:#999;margin:0">Simplify Finance</p>
                  </div>
                </td></tr>
                <tr><td style="background:#343333;padding:14px 16px;text-align:center">
                  <p style="color:rgba(255,255,255,0.4);font-size:10px;margin:0">&copy; 2026 Simplify Finance | St Leonards, Sydney | Australian Credit Licence: 387025</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        `
      })
    })
  } catch (e) {
    // Non-fatal — the invite itself already succeeded
  }

  return NextResponse.json({ ok: true })
}
