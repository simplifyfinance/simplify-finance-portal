import type { Metadata } from 'next'

// Outside app/(app), so the "· ONE" template does not reach here - it says it
// in full. Reached from the staff reset email.
export const metadata: Metadata = { title: 'Reset password · ONE' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
