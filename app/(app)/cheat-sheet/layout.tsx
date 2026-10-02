import type { Metadata } from 'next'

// The rate cheat sheet.
//
// This page is a browser component, and a browser component cannot carry a page
// title - Next only reads metadata from a server file. So the title lives in a
// layout beside it, which renders its children unchanged and adds nothing to
// the page.
export const metadata: Metadata = { title: 'Cheat sheet' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
