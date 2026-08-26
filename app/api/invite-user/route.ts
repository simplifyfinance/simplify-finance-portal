import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { email, fullName, role, brokerKey } = await req.json()

  if (!email || !fullName || !role) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }

  const supabaseAdmin = createSupabaseAdmin()

  // Try to create auth user — if they already exist, skip and still send welcome email
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }
  })

  const alreadyExists = !!error && (
    error.message.toLowerCase().includes('already registered') ||
    error.message.toLowerCase().includes('already been registered') ||
    error.message.toLowerCase().includes('user already exists')
  )

  if (error && !alreadyExists) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Only insert profile if this is a genuinely new user
  if (!error && data?.user) {
    // A broker with no key never appears on Targets or the Pipeline, so it is set
    // at invite time rather than left for someone to notice later.
    const key = typeof brokerKey === 'string'
      ? brokerKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || null
      : null

    const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
      id: data.user.id,
      email,
      full_name: fullName,
      role,
      broker_key: role === 'broker' ? key : null,
      is_admin: role === 'admin',
      active: true
    })
    if (profileError && !profileError.message.includes('duplicate')) {
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 })
    }
  }

  // Send welcome email — fires for both new and existing users
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
        html: `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f3" style="background:#f5f5f3;font-family:Arial,sans-serif"><tr><td><table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background:#ffffff;margin:0 auto"><tr><td bgcolor="#343333" style="background:#343333;padding:28px 24px;text-align:center"><img src="https://simplify-finance-portal.vercel.app/logo-charcoal.png" alt="Simplify Finance" style="height:80px;width:auto;display:block;margin:0 auto 8px" /><p style="color:#9E9E9E;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0"><span style="color:#9E9E9E;">Finance, Simplified.</span></p></td></tr><tr><td style="padding:32px 28px"><p style="font-size:15px;color:#343333;margin:0 0 20px"><span style="color:#343333;">Hi ${firstName},</span></p><p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 16px"><span style="color:#333;">You've been invited to the Simplify Finance Credit &amp; Compliance Portal &mdash; our internal system for managing deals, borrowing capacity reviews, lending options, and compliance.</span></p><p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 8px"><span style="color:#333;">To get set up, follow these steps:</span></p><p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 6px"><span style="color:#333;">1. Check your inbox (and spam folder) for a separate email from Supabase &mdash; click the activation link inside it.</span></p><p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 6px"><span style="color:#333;">2. Once you've clicked that link, go to: <a href="https://simplify-finance-portal.vercel.app/login" style="color:#2DBEFF">simplify-finance-portal.vercel.app/login</a></span></p><p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 6px"><span style="color:#333;">3. Click <strong>Forgot password?</strong>, enter your email address, and follow the prompts to set your own password.</span></p><p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 24px"><span style="color:#333;">4. Log in &mdash; your access and permissions are already set up.</span></p><p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 24px"><span style="color:#333;">If you have any trouble, reply to this email and I'll help you out.</span></p><p style="font-size:14px;color:#333;margin:0"><span style="color:#333;">Welcome to the team portal!</span></p><div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;max-width:240px;margin-top:24px"><p style="font-size:14px;font-weight:600;color:#333;margin:0 0 2px"><span style="color:#333;">Fabio de Castro</span></p><p style="font-size:12px;color:#666;margin:0 0 2px"><span style="color:#666;">Director / Mortgage Broker</span></p><p style="font-size:11px;color:#999;margin:0"><span style="color:#999;">Simplify Finance</span></p></div></td></tr><tr><td bgcolor="#343333" style="background:#343333;padding:14px 16px;text-align:center"><p style="color:#9E9E9E;font-size:10px;margin:0"><span style="color:#9E9E9E;">&copy; 2026 Simplify Finance | St Leonards, Sydney | Australian Credit Licence: 387025</span></p></td></tr></table></td></tr></table>`
      })
    })
  } catch (e) {
    // Non-fatal
  }

  return NextResponse.json({ ok: true })
}
