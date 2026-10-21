import type { Metadata } from 'next'

// The knowledge base page is a browser component, and a browser component
// cannot carry a page title - Next only reads metadata from a server file. So
// the title lives in a layout beside it, exactly as the cheat sheet does.
export const metadata: Metadata = { title: 'Knowledge base' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
