import { createBrowserClient } from '@supabase/ssr'

// IMPORTANT: this must be the @supabase/ssr browser client, not createClient from
// @supabase/supabase-js. The plain client looks for a session in localStorage and
// never sees the auth cookie the server sets, so every request goes out anonymous.
// RLS then silently returns nothing - zero rows changed, no error raised.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
