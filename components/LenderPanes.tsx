'use client'
import { useEffect, useState } from 'react'
import LenderLibrary from '@/components/LenderLibrary'
import CommissionLibrary from '@/components/CommissionLibrary'

// Which pane shows is driven by the URL hash, the same mechanism Settings uses, so
// the sidebar steers both the same way.
export default function LenderPanes() {
  const [pane, setPane] = useState('lenders')
  useEffect(() => {
    const read = () => setPane(window.location.hash.slice(1) === 'commissions' ? 'commissions' : 'lenders')
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  if (pane === 'commissions') {
    return (
      <>
        <h1 className="text-2xl font-bold text-[#343333] mb-1">Commission library</h1>
        <p className="text-sm text-gray-500 mb-8">What each lender pays, on what basis, and what they claw back.</p>
        <CommissionLibrary />
      </>
    )
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-[#343333] mb-1">Lender Library</h1>
      <p className="text-sm text-gray-500 mb-8">Manage lenders and products. Import from a PDF or URL, or add manually.</p>
      <LenderLibrary />
    </>
  )
}
