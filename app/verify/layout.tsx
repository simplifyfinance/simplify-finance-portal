import type { Metadata } from 'next'

// Outside app/(app), like the sign-in screen beside it, so the "· ONE" title
// template does not reach here. A browser component cannot carry a title.
export const metadata: Metadata = { title: 'Your code · ONE' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
