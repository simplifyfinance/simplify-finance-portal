'use client'
import { useEffect, useState, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type Lender = { id: string; name: string; active: boolean }
type Product = {
  id: string
  lender_id: string
  product_name: string
  rate_type: string
  loan_purpose: string
  application_fee: string
  annual_fee: string
  valuation_fee: string
  rate_lock_fee: string
  offset_account: boolean
  multiple_offsets: boolean
  notes: string
  is_draft: boolean
  active: boolean
}
type ExtractedProduct = {
  product_name: string
  rate_type: string
  loan_purpose: string
  application_fee: string | null
  annual_fee: string | null
  valuation_fee: string | null
  rate_lock_fee: string | null
  offset_account: boolean
  multiple_offsets: boolean
  notes: string
  lender_name: string
  selected: boolean
}

const emptyProduct = {
  product_name: '',
  rate_type: 'variable',
  loan_purpose: 'both',
  application_fee: '',
  annual_fee: '',
  valuation_fee: '',
  rate_lock_fee: '',
  offset_account: false,
  multiple_offsets: false,
  notes: '',
  is_draft: true,
  active: true,
}

export default function LenderLibrary() {
  const supabase = createSupabaseBrowser()
  const [lenders, setLenders] = useState<Lender[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAddLender, setShowAddLender] = useState(false)
  const [newLenderName, setNewLenderName] = useState('')
  const [savingLender, setSavingLender] = useState(false)
  const [productModal, setProductModal] = useState<{ lenderId: string; lenderName: string } | null>(null)
  const [productForm, setProductForm] = useState({ ...emptyProduct })
  const [editProductId, setEditProductId] = useState<string | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'lender' | 'product'; id: string; name: string } | null>(null)

  const [importModal, setImportModal] = useState(false)
  const [importTab, setImportTab] = useState<'pdf' | 'url'>('pdf')
  const [importUrl, setImportUrl] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([])
  const [importStep, setImportStep] = useState<'input' | 'review'>('input')
  const [savingImport, setSavingImport] = useState(false)
  const [targetLenderId, setTargetLenderId] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]'
  const sel = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF] bg-white'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: lData }, { data: pData }] = await Promise.all([
      supabase.from('lenders').select('*').order('name'),
      supabase.from('lender_products').select('*').order('product_name'),
    ])
    if (lData) setLenders(lData)
    if (pData) setProducts(pData)
    setLoading(false)
  }

  async function addLender() {
    if (!newLenderName.trim()) return
    setSavingLender(true)
    const { data } = await supabase.from('lenders').insert({ name: newLenderName.trim(), active: true }).select().single()
    if (data) {
      setLenders(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setExpanded(prev => new Set([...prev, data.id]))
    }
    setNewLenderName('')
    setShowAddLender(false)
    setSavingLender(false)
  }

  async function toggleLenderActive(id: string, active: boolean) {
    await supabase.from('lenders').update({ active: !active }).eq('id', id)
    setLenders(prev => prev.map(l => l.id === id ? { ...l, active: !active } : l))
  }

  async function deleteLender(id: string) {
    await supabase.from('lender_products').delete().eq('lender_id', id)
    await supabase.from('lenders').delete().eq('id', id)
    setLenders(prev => prev.filter(l => l.id !== id))
    setProducts(prev => prev.filter(p => p.lender_id !== id))
    setConfirmDelete(null)
  }

  async function deleteProduct(id: string) {
    await supabase.from('lender_products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  function openAddProduct(lenderId: string, lenderName: string) {
    setProductForm({ ...emptyProduct })
    setEditProductId(null)
    setProductModal({ lenderId, lenderName })
  }

  function openEditProduct(product: Product, lenderName: string) {
    setProductForm({
      product_name: product.product_name,
      rate_type: product.rate_type,
      loan_purpose: product.loan_purpose,
      application_fee: product.application_fee || '',
      annual_fee: product.annual_fee || '',
      valuation_fee: product.valuation_fee || '',
      rate_lock_fee: product.rate_lock_fee || '',
      offset_account: product.offset_account,
      multiple_offsets: product.multiple_offsets,
      notes: product.notes || '',
      is_draft: product.is_draft,
      active: product.active,
    })
    setEditProductId(product.id)
    setProductModal({ lenderId: product.lender_id, lenderName })
  }

  async function saveProduct() {
    if (!productModal || !productForm.product_name.trim()) return
    setSavingProduct(true)
    if (editProductId) {
      await supabase.from('lender_products').update(productForm).eq('id', editProductId)
      setProducts(prev => prev.map(p => p.id === editProductId ? { ...p, ...productForm } : p))
    } else {
      const payload = { ...productForm, lender_id: productModal.lenderId }
      const { data } = await supabase.from('lender_products').insert(payload).select().single()
      if (data) setProducts(prev => [...prev, data])
    }
    setProductModal(null)
    setEditProductId(null)
    setSavingProduct(false)
  }

  async function toggleProductActive(id: string, active: boolean) {
    await supabase.from('lender_products').update({ active: !active }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p))
  }

  async function toggleProductDraft(id: string, isDraft: boolean) {
    await supabase.from('lender_products').update({ is_draft: !isDraft }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_draft: !isDraft } : p))
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function lenderProducts(lenderId: string) {
    return products.filter(p => p.lender_id === lenderId)
  }

  function fmtFee(val: string) {
    if (!val || val === '0' || val.toLowerCase() === 'none') return ''
    return val
  }

  function openImport() {
    setImportModal(true)
    setImportStep('input')
    setImportTab('pdf')
    setImportUrl('')
    setImportFile(null)
    setExtractError('')
    setExtractedProducts([])
    setTargetLenderId('')
  }

  async function runExtraction() {
    if (importTab === 'pdf' && !importFile) return
    if (importTab === 'url' && !importUrl.trim()) return
    setExtracting(true)
    setExtractError('')
    try {
      const fd = new FormData()
      if (importTab === 'pdf' && importFile) fd.append('file', importFile)
      else fd.append('url', importUrl.trim())
      const res = await fetch('/api/extract-lender', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      const withSelected = (data.products as ExtractedProduct[]).map(p => ({ ...p, selected: true }))
      setExtractedProducts(withSelected)
      if (withSelected.length > 0) {
        const detectedName = withSelected[0].lender_name?.toLowerCase() || ''
        const match = lenders.find(l => l.name.toLowerCase() === detectedName || detectedName.includes(l.name.toLowerCase()))
        if (match) setTargetLenderId(match.id)
      }
      setImportStep('review')
    } catch (err: any) {
      setExtractError(err.message || 'Something went wrong')
    }
    setExtracting(false)
  }

  async function saveImport() {
    const selected = extractedProducts.filter(p => p.selected)
    if (!selected.length) return
    setSavingImport(true)
    try {
      let lenderId = targetLenderId
      if (!lenderId) {
        const lenderName = extractedProducts[0].lender_name || 'Unknown Lender'
        const { data } = await supabase.from('lenders').insert({ name: lenderName, active: true }).select().single()
        if (data) {
          lenderId = data.id
          setLenders(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        }
      }
      const rows = selected.map(p => ({
        lender_id: lenderId,
        product_name: p.product_name,
        rate_type: p.rate_type,
        loan_purpose: p.loan_purpose,
        application_fee: p.application_fee || '',
        annual_fee: p.annual_fee || '',
        valuation_fee: p.valuation_fee || '',
        rate_lock_fee: p.rate_lock_fee || '',
        offset_account: p.offset_account,
        multiple_offsets: p.multiple_offsets,
        notes: p.notes || '',
        is_draft: true,
        active: true,
      }))
      const { data: newProducts } = await supabase.from('lender_products').insert(rows).select()
      if (newProducts) setProducts(prev => [...prev, ...newProducts])
      setExpanded(prev => new Set([...prev, lenderId]))
      setImportModal(false)
    } catch (err: any) {
      setExtractError(err.message)
    }
    setSavingImport(false)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading lender library...</p>

  return (
    <section className="mb-10">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Lender Library</h2>
        <div className="flex gap-2">
          <button onClick={openImport} className="text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
            ✦ Import via AI
          </button>
          <button onClick={() => { setShowAddLender(true); setNewLenderName('') }} className="text-sm text-[#343333] border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
            + Add lender
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Small changes (fee update, new product) → use <span className="font-medium text-gray-500">Edit</span>. &nbsp;
        Major changes → <span className="font-medium text-gray-500">Delete lender</span> and reimport via PDF or URL.
      </p>

      {showAddLender && (
        <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
          <p className="text-sm font-medium text-[#343333] mb-3">New lender</p>
          <div className="flex gap-2">
            <input className={inp + ' flex-1'} placeholder="Lender name e.g. Westpac" value={newLenderName} onChange={e => setNewLenderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLender()} autoFocus />
            <button onClick={addLender} disabled={savingLender || !newLenderName.trim()} className="bg-[#343333] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-40">{savingLender ? 'Saving...' : 'Save'}</button>
            <button onClick={() => setShowAddLender(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {lenders.map(lender => {
          const lps = lenderProducts(lender.id)
          const isOpen = expanded.has(lender.id)
          return (
            <div key={lender.id} className={`border border-gray-200 rounded-xl bg-white overflow-hidden ${!lender.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition" onClick={() => toggleExpand(lender.id)}>
                <div className="flex items-center gap-3">
                  <span className={`text-gray-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                  <div>
                    <p className="text-sm font-medium text-[#343333]">{lender.name}</p>
                    <p className="text-xs text-gray-400">{lps.length} product{lps.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${lender.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{lender.active ? 'Active' : 'Inactive'}</span>
                  <button onClick={() => toggleLenderActive(lender.id, lender.active)} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5">{lender.active ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => setConfirmDelete({ type: 'lender', id: lender.id, name: lender.name })} className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-2 py-0.5">Delete</button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-gray-100">
                  {lps.length === 0 && <p className="text-xs text-gray-400 px-5 py-3">No products yet.</p>}
                  {lps.map(product => {
                    const fees = [
                      fmtFee(product.application_fee) ? `App ${fmtFee(product.application_fee)}` : '',
                      fmtFee(product.annual_fee) ? `Annual ${fmtFee(product.annual_fee)}` : '',
                    ].filter(Boolean).join(' · ')
                    const offsetLabel = product.offset_account ? (product.multiple_offsets ? 'Multiple offsets' : 'Offset') : 'No offset'
                    return (
                      <div key={product.id} className={`px-4 py-2.5 border-b border-gray-50 last:border-b-0 ${!product.active ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-[#343333]">{product.product_name}</p>
                              {product.is_draft ? <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Draft</span> : <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Live</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {product.rate_type === 'variable' ? 'Variable' : product.rate_type === 'fixed' ? 'Fixed' : 'Variable + Fixed'}
                              {' · '}
                              {product.loan_purpose === 'oo' ? 'OO only' : product.loan_purpose === 'investment' ? 'INV only' : 'OO + INV'}
                              {fees ? ` · ${fees}` : ''}
                              {` · ${offsetLabel}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <button onClick={() => toggleProductDraft(product.id, product.is_draft)} className={`text-xs border rounded px-2 py-0.5 transition ${product.is_draft ? 'border-green-200 text-green-600 hover:bg-green-50' : 'border-amber-200 text-amber-600 hover:bg-amber-50'}`}>{product.is_draft ? 'Go live' : 'Set draft'}</button>
                            <button onClick={() => openEditProduct(product, lender.name)} className="text-xs text-white bg-[#2DBEFF] hover:bg-blue-400 rounded px-2 py-0.5 transition">Edit</button>
                            <button onClick={() => toggleProductActive(product.id, product.active)} className={`text-xs border rounded px-2 py-0.5 transition ${product.active ? 'border-red-200 text-red-400 hover:bg-red-50' : 'border-green-200 text-green-500 hover:bg-green-50'}`}>{product.active ? 'Deactivate' : 'Activate'}</button>
                            <button onClick={() => setConfirmDelete({ type: 'product', id: product.id, name: product.product_name })} className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-2 py-0.5">Delete</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="px-4 py-2.5">
                    <button onClick={() => openAddProduct(lender.id, lender.name)} className="text-xs text-[#2DBEFF] hover:underline">+ Add product</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {lenders.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No lenders yet. Add your first lender above.</p>}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5">
            <p className="font-semibold text-[#343333] mb-1">Delete {confirmDelete.type === 'lender' ? 'lender' : 'product'}?</p>
            <p className="text-sm text-gray-500 mb-4"><span className="font-medium text-[#343333]">{confirmDelete.name}</span>{confirmDelete.type === 'lender' ? ' and all its products will be permanently deleted.' : ' will be permanently deleted.'}</p>
            <button onClick={() => confirmDelete.type === 'lender' ? deleteLender(confirmDelete.id) : deleteProduct(confirmDelete.id)} className="w-full bg-red-500 text-white text-sm py-2.5 rounded-lg hover:bg-red-600 mb-2">Yes, delete</button>
            <button onClick={() => setConfirmDelete(null)} className="w-full text-sm text-gray-400 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* AI Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-semibold text-[#343333]">{importStep === 'input' ? '✦ Import via AI' : 'Review extracted products'}</p>
                <p className="text-xs text-gray-400">{importStep === 'input' ? 'Upload a PDF or paste a URL to extract lender products' : 'Select which products to save — all start as draft'}</p>
              </div>
              <button onClick={() => setImportModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {importStep === 'input' && (
              <>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-4">
                  <button onClick={() => setImportTab('pdf')} className={`flex-1 py-2 text-sm transition ${importTab === 'pdf' ? 'bg-[#343333] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Upload PDF</button>
                  <button onClick={() => setImportTab('url')} className={`flex-1 py-2 text-sm transition ${importTab === 'url' ? 'bg-[#343333] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Paste URL</button>
                </div>
                {importTab === 'pdf' && (
                  <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#2DBEFF] hover:bg-blue-50/20 transition mb-4">
                    <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                    {importFile ? (
                      <div>
                        <p className="text-sm font-medium text-[#343333]">{importFile.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{(importFile.size / 1024).toFixed(0)} KB · Click to change</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Drop a lender rate sheet or features PDF</p>
                        <p className="text-xs text-gray-400">or click to browse · PDF up to 20MB</p>
                      </div>
                    )}
                  </div>
                )}
                {importTab === 'url' && (
                  <div className="mb-4">
                    <input className={inp} placeholder="https://www.lender.com.au/rates/product-guide.pdf" value={importUrl} onChange={e => setImportUrl(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1.5">Works best with direct links to PDF rate sheets or product pages</p>
                  </div>
                )}
                {extractError && <p className="text-sm text-red-500 mb-3">{extractError}</p>}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button onClick={() => setImportModal(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                  <button onClick={runExtraction} disabled={extracting || (importTab === 'pdf' ? !importFile : !importUrl.trim())} className="bg-[#2DBEFF] text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-400 disabled:opacity-40 flex items-center gap-2">
                    {extracting ? (<><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> Extracting...</>) : '✦ Extract with AI'}
                  </button>
                </div>
              </>
            )}

            {importStep === 'review' && (
              <>
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">Save products to lender</label>
                  <select className={sel} value={targetLenderId} onChange={e => setTargetLenderId(e.target.value)}>
                    <option value="">— Create new lender from document —</option>
                    {lenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">AI detected: <span className="font-medium text-[#343333]">{extractedProducts[0]?.lender_name || 'Unknown'}</span> · Change if incorrect</p>
                </div>
                <div className="space-y-2 mb-4">
                  {extractedProducts.map((p, i) => (
                    <div key={i} onClick={() => setExtractedProducts(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                      className={`border rounded-xl p-3 cursor-pointer transition ${p.selected ? 'border-[#2DBEFF] bg-blue-50/20' : 'border-gray-200 opacity-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-[#343333]">{p.product_name}</p>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${p.selected ? 'bg-[#2DBEFF] border-[#2DBEFF]' : 'border-gray-300'}`}>
                          {p.selected && <span className="text-white text-xs">✓</span>}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {p.rate_type === 'variable' ? 'Variable' : p.rate_type === 'fixed' ? 'Fixed' : 'Variable + Fixed'}
                        {' · '}
                        {p.loan_purpose === 'oo' ? 'OO only' : p.loan_purpose === 'investment' ? 'INV only' : 'OO + INV'}
                        {p.application_fee ? ` · App ${p.application_fee}` : ''}
                        {p.annual_fee && p.annual_fee !== 'None' ? ` · Annual ${p.annual_fee}` : ''}
                        {' · '}{p.offset_account ? (p.multiple_offsets ? 'Multiple offsets' : 'Offset') : 'No offset'}
                      </p>
                      {p.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{p.notes}</p>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mb-4">All saved products start as <span className="text-amber-600 font-medium">Draft</span> — go live from the library after reviewing.</p>
                {extractError && <p className="text-sm text-red-500 mb-3">{extractError}</p>}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button onClick={() => setImportStep('input')} className="text-sm text-gray-400 hover:text-gray-600 px-3">Back</button>
                  <button onClick={saveImport} disabled={savingImport || !extractedProducts.some(p => p.selected)} className="bg-[#343333] text-white text-sm px-5 py-2 rounded-lg hover:bg-[#2a2a2a] disabled:opacity-40">
                    {savingImport ? 'Saving...' : `Save ${extractedProducts.filter(p => p.selected).length} product${extractedProducts.filter(p => p.selected).length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {productModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-semibold text-[#343333]">{editProductId ? 'Edit product' : 'Add product'}</p>
                <p className="text-xs text-gray-400">{productModal.lenderName}</p>
              </div>
              <button onClick={() => setProductModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Product name</label>
                  <input className={inp} value={productForm.product_name} onChange={e => setProductForm({...productForm, product_name: e.target.value})} placeholder="e.g. Neat — Variable" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Rate type</label>
                  <select className={sel} value={productForm.rate_type} onChange={e => setProductForm({...productForm, rate_type: e.target.value})}>
                    <option value="variable">Variable</option>
                    <option value="fixed">Fixed</option>
                    <option value="both">Variable + Fixed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Loan purpose</label>
                  <select className={sel} value={productForm.loan_purpose} onChange={e => setProductForm({...productForm, loan_purpose: e.target.value})}>
                    <option value="both">OO + Investment</option>
                    <option value="oo">Owner-occupier only</option>
                    <option value="investment">Investment only</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Fees</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Application / advance fee</label>
                    <input className={inp} value={productForm.application_fee} onChange={e => setProductForm({...productForm, application_fee: e.target.value})} placeholder="e.g. $250" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Annual / ongoing fee</label>
                    <input className={inp} value={productForm.annual_fee} onChange={e => setProductForm({...productForm, annual_fee: e.target.value})} placeholder="e.g. $395/yr or None" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Valuation fee</label>
                    <input className={inp} value={productForm.valuation_fee} onChange={e => setProductForm({...productForm, valuation_fee: e.target.value})} placeholder="e.g. Free up to $360" />
                  </div>
                  {(productForm.rate_type === 'fixed' || productForm.rate_type === 'both') && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Rate lock fee</label>
                      <input className={inp} value={productForm.rate_lock_fee} onChange={e => setProductForm({...productForm, rate_lock_fee: e.target.value})} placeholder="e.g. $500" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Offset</p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={productForm.offset_account} onChange={e => setProductForm({...productForm, offset_account: e.target.checked, multiple_offsets: e.target.checked ? productForm.multiple_offsets : false})} />
                    Offset account available
                  </label>
                  {productForm.offset_account && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={productForm.multiple_offsets} onChange={e => setProductForm({...productForm, multiple_offsets: e.target.checked})} />
                      Multiple offset accounts
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Internal notes</label>
                <textarea className={inp} rows={2} value={productForm.notes} onChange={e => setProductForm({...productForm, notes: e.target.value})} placeholder="Turnaround times, policy notes — not shown in LO email" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => { setProductModal(null); setEditProductId(null) }} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
              <button onClick={saveProduct} disabled={savingProduct || !productForm.product_name.trim()} className="bg-[#343333] text-white text-sm px-5 py-2 rounded-lg hover:bg-[#2a2a2a] disabled:opacity-40">
                {savingProduct ? 'Saving...' : editProductId ? 'Update product' : 'Save product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
