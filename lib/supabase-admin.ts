import { createClient } from '@supabase/supabase-js'

// This client uses the service role key, which bypasses all Row Level Security.
// Only ever import this in server-side code (API routes), never in a 'use client' file,
// and never send this key to the browser.
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
