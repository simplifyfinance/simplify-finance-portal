import LenderLibrary from '@/components/LenderLibrary'

export default function LendersPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#343333] mb-1">Lender Library</h1>
      <p className="text-sm text-gray-500 mb-8">Manage lenders and products. Import from a PDF or URL, or add manually.</p>
      <LenderLibrary />
    </div>
  )
}
