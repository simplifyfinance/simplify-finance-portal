import type { Metadata } from 'next'

// Outside app/(app), so the "· ONE" template does not reach here - it says it
// in full. Staff only, so it carries the product name.
export const metadata: Metadata = { title: 'Sign in · ONE' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
