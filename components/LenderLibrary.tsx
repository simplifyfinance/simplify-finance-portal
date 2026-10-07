'use client'
import { useEffect, useState, useRef, Fragment } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { useBusyWhile } from '@/components/useBusy'
import { SkelLine, SkelTile, SkelPanel, SkelRows } from '@/components/Skeleton'
import { legalFeeLabel, confirmedFeeLabel, DEFAULT_LEGAL_FEE_LABEL, feeText } from '@/lib/lender-fees'
import { readNotice, announcedFrom, hasTakenEffect, niceDate, NO_NOTICE } from '@/lib/rate-notice'

// legal_fee_label: what THIS bank calls the fee charged at settlement. Most say
// "Settlement fee"; Bankwest says "Legal fee". Blank means Legal fee, which is
// what every lender said before the column existed. See lib/lender-fees.ts.
type Lender = { id: string; name: string; active: boolean; legal_fee_label?: string | null
  // What this bank calls itself on a bank statement. CBA, CommBank, NAB. The
  // statement analysis reports short codes, the fact find records full names,
  // and nothing could match the two. Comma separated, because one bank arrives
  // under more than one code. Fabio, 3 Sep 2026: "I'm okay with adding a short
  // code column for the lender library."
  statement_codes?: string | null
  // HOW FAR THE LOAN MAY MOVE before this bank wants the pricing redone. Null is
  // N/A and stays N/A - see docs/lender-reprice-schema.sql for why nothing is
  // ever assumed here.
  reprice_over_percent?: number | null
  rate_notice_for?: string | null
  rate_notice_from?: string | null
  rate_notice_by?: string | null
  rate_notice_at?: string | null }
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
  early_repayment_fee: string
  discharge_fee: string
  legal_fee: string
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
  early_repayment_fee: string | null
  discharge_fee: string | null
  legal_fee: string | null
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
  early_repayment_fee: '',
  discharge_fee: '',
  legal_fee: '',
  offset_account: false,
  multiple_offsets: false,
  notes: '',
  is_draft: true,
  active: true,
}

export default function LenderLibrary() {
  const supabase = createSupabaseBrowser()
  const [lenders, setLenders] = useState<Lender[]>([])
  // The running RBA notice, if there is one, and who is ticking lenders off
  // against it. Nothing is drawn for either when no notice is on.
  const [notice, setNotice] = useState(NO_NOTICE)
  const [meName, setMeName] = useState('')
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
  // WHAT IS ON SCREEN, AND WHAT IS PUT AWAY.
  // Archived is off by default. Everything archived still exists, still sits
  // on the deals that used it, and is one button from coming back.
  const [showArchived, setShowArchived] = useState(false)
  const [find, setFind] = useState('')
  // product id -> how many deals chose it. Filled when a bank is opened.
  const [usedBy, setUsedBy] = useState<Record<string, number>>({})
  // The archive question, drawn under the row it is about rather than over it.
  const [archiveAsk, setArchiveAsk] =
    useState<{ kind: 'lender' | 'product'; id: string; name: string; holds: string } | null>(null)

  const [importModal, setImportModal] = useState(false)
  const [importTab, setImportTab] = useState<'pdf' | 'url'>('pdf')
  const [importUrl, setImportUrl] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  // Every write on this screen used to update the list on screen and never look
  // at what the database said. A blocked write left the change visible until the
  // page was reloaded, and then it was simply gone.
  const [writeError, setWriteError] = useState('')
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([])
  const [importStep, setImportStep] = useState<'input' | 'review'>('input')
  const [savingImport, setSavingImport] = useState(false)
  const [targetLenderId, setTargetLenderId] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand'
  const sel = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand bg-card'

  useEffect(() => { fetchAll() }, [])

  // WHOSE NAME GOES ON A TICK. Everybody can tick one, so the name is the only
  // thing that makes a wrong one askable afterwards.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id
      if (!id) return
      supabase.from('user_profiles').select('full_name, email').eq('id', id).maybeSingle()
        .then(({ data: p }: any) => setMeName(p?.full_name || p?.email || ''))
    })
  }, [])

  async function fetchAll() {
    const [{ data: lData }, { data: pData }, { data: sData }] = await Promise.all([
      supabase.from('lenders').select('*').order('name'),
      supabase.from('lender_products').select('*').order('product_name'),
      // A settings table without the column yet comes back empty and nothing is
      // drawn - the same way the rest of this page degrades.
      supabase.from('settings').select('rate_notice').eq('id', 'singleton').maybeSingle(),
    ])
    setNotice(readNotice((sData as any)?.rate_notice))
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

  // Set once on the bank; every product underneath it inherits the wording.
  async function setStatementCodes(id: string, raw: string) {
    // Stored tidied, so "cba, CommBank ,, " and "CBA,CommBank" are the same
    // thing to whatever reads it back.
    const value = raw.split(',').map(x => x.trim()).filter(Boolean).join(', ')
    const problem = await checkedWrite(
      supabase.from('lenders').update({ statement_codes: value || null }).eq('id', id), 'The statement codes')
    if (problem) { setWriteError(problem); return }
    setWriteError('')
    setLenders(prev => prev.map(l => l.id === id ? { ...l, statement_codes: value || null } : l))
  }

  // Typed as a percentage, stored as a number. Empty puts it back to N/A, which
  // is how a rule gets removed when a bank drops it.
  // WHEN THIS BANK'S CHANGE TAKES EFFECT.
  //
  // A date, not a tick. Fabio, 30 Sep 2026: "rate will increase on the 21st of
  // October I need the disclaiumer to go out on all Macquaire emails until the
  // 21st of October AFTER THAT date the disclaimer disapear". The bank names the
  // day when it announces, weeks ahead - so it is recorded once and the notice
  // ends itself. Nobody has to be at their desk on the morning for a client
  // email to be right.
  //
  // Everybody can set one. Fabio: "anyone can do this as it is a team effort".
  // The name goes on it, because somebody has to be askable when a date is wrong.
  async function setEffectiveFrom(id: string, raw: string) {
    const value = raw.trim() || null
    const problem = await checkedWrite(
      supabase.from('lenders').update({
        // Stamped with the decision it answers, so the next RBA decision clears
        // every one of these by itself - see lib/rate-notice.ts.
        rate_notice_for: value ? notice.decisionDate : null,
        rate_notice_from: value,
        rate_notice_by: value ? (meName || null) : null,
        rate_notice_at: value ? new Date().toISOString() : null,
      }).eq('id', id),
      'That date')
    if (problem) { setWriteError(problem); return }
    setWriteError('')
    setLenders(prev => prev.map(l => l.id === id ? {
      ...l,
      rate_notice_for: value ? notice.decisionDate : null,
      rate_notice_from: value,
      rate_notice_by: value ? meName : null,
      rate_notice_at: value ? new Date().toISOString() : null,
    } : l))
  }

  async function setRepriceOver(id: string, raw: string) {
    const clean = raw.replace(/[^0-9.]/g, '').trim()
    const value = clean === '' ? null : Number(clean)
    if (value !== null && !Number.isFinite(value)) { setWriteError('That is not a number.'); return }
    const problem = await checkedWrite(
      supabase.from('lenders').update({ reprice_over_percent: value }).eq('id', id),
      'The repricing rule')
    if (problem) { setWriteError(problem); return }
    setWriteError('')
    setLenders(prev => prev.map(l => l.id === id ? { ...l, reprice_over_percent: value } : l))
  }

  async function setLegalFeeLabel(id: string, label: string) {
    const value = label.trim() || null
    const problem = await checkedWrite(
      supabase.from('lenders').update({ legal_fee_label: value }).eq('id', id), 'The fee wording')
    if (problem) { setWriteError(problem); return }
    setWriteError('')
    setLenders(prev => prev.map(l => l.id === id ? { ...l, legal_fee_label: value } : l))
  }

  async function toggleLenderActive(id: string, active: boolean) {
    const problem = await checkedWrite(
      supabase.from('lenders').update({ active: !active }).eq('id', id), 'That lender')
    if (problem) { setWriteError(problem); return }
    setWriteError('')
    setLenders(prev => prev.map(l => l.id === id ? { ...l, active: !active } : l))
    setArchiveAsk(null)
  }

  // WHY THE DATABASE WILL REFUSE, SAID BEFORE IT REFUSES.
  //
  // A lender that any deal or any commission rate points at cannot be deleted -
  // the row is holding up real records, and that is right. What was not right is
  // what a person saw: they pressed the confirm button, the database said no, and the
  // sentence explaining it was drawn underneath the very popup they were looking
  // at. Fabio, 16 Sep 2026: "delete lender sticks."
  //
  // So it is counted first and said in words, with the thing they should do
  // instead. Marking a lender inactive takes it off every dropdown and keeps
  // every deal that used it intact, which is what "delete" was being reached for.
  // WHAT A BANK IS HOLDING.
  // This used to be the reason a delete was refused. Nothing is deleted any
  // more, so the same two counts now say what archiving will leave alone.
  async function whatBankHolds(id: string): Promise<string> {
    const { count: dealCount } = await supabase
      .from('deals').select('id', { count: 'exact', head: true }).eq('lender_id', id)
    const { count: rateCount } = await supabase
      .from('commission_rates').select('id', { count: 'exact', head: true }).eq('lender_id', id)

    const held: string[] = []
    if (dealCount) held.push(`${dealCount} ${dealCount === 1 ? 'deal' : 'deals'}`)
    if (rateCount) held.push(`${rateCount} commission ${rateCount === 1 ? 'rate' : 'rates'}`)
    return held.join(' and ')
  }

  // HOW MANY DEALS CHOSE THIS PRODUCT.
  // A deal keeps the product's id inside lo_data.lenders, so this asks the
  // database whether that blob contains it rather than dragging every deal's
  // loan options record across the wire to count them here.
  // A count that fails comes back as -1 and the screen then says nothing,
  // because a wrong number beside an Archive button is worse than no number.
  async function countProductUses(id: string): Promise<number> {
    try {
      const { count, error } = await supabase.from('deals')
        .select('id', { count: 'exact', head: true })
        .contains('lo_data', { lenders: [{ lenderProductId: id }] })
      if (error) return -1
      return count ?? 0
    } catch { return -1 }
  }

  // Counted when a bank is opened, once per product, and never again.
  async function countUsesFor(ids: string[]) {
    const missing = ids.filter(id => usedBy[id] === undefined)
    if (!missing.length) return
    const pairs = await Promise.all(missing.map(async id => [id, await countProductUses(id)] as const))
    setUsedBy(prev => {
      const next = { ...prev }
      for (const [id, n] of pairs) next[id] = n
      return next
    })
  }

  // THE ARCHIVE QUESTION. The write itself is toggleProductActive and
  // toggleLenderActive, which have not changed - this only decides what the
  // question says before one of them runs.
  function askArchiveProduct(product: Product) {
    const n = usedBy[product.id]
    const holds = n === undefined || n < 0 ? '' : `${n} ${n === 1 ? 'deal' : 'deals'}`
    setArchiveAsk({ kind: 'product', id: product.id, name: product.product_name, holds })
  }

  async function askArchiveLender(lender: Lender) {
    setArchiveAsk({ kind: 'lender', id: lender.id, name: lender.name, holds: '' })
    const holds = await whatBankHolds(lender.id)
    setArchiveAsk(prev => prev && prev.id === lender.id ? { ...prev, holds } : prev)
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
      early_repayment_fee: product.early_repayment_fee || '',
      discharge_fee: product.discharge_fee || '',
      legal_fee: product.legal_fee || '',
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

  // EVERY FEE GETS ITS DOLLAR SIGN ON THE WAY IN.
  //
  // These boxes are free text because a fee is not always a number - "None —
  // government fees only" is a real answer. But it means somebody types 250 and
  // the client sees 250 next to another lender's $350. Fabio, 4 Sep 2026: "it
  // keeps dropping off the dollar sign." A bare number gets one; a sentence is
  // left exactly as typed. See feeText in lib/lender-fees.ts.
  const FEE_FIELDS = ['application_fee', 'annual_fee', 'valuation_fee', 'legal_fee',
                      'rate_lock_fee', 'early_repayment_fee', 'discharge_fee'] as const

  function withTidyFees(form: typeof productForm) {
    const out: any = { ...form }
    for (const k of FEE_FIELDS) if (k in out) out[k] = feeText(out[k])
    return out
  }

  async function saveProduct() {
    if (!productModal || !productForm.product_name.trim()) return
    setSavingProduct(true)
    const tidy = withTidyFees(productForm)
    if (editProductId) {
      const problem = await checkedWrite(
        supabase.from('lender_products').update(tidy).eq('id', editProductId), 'That product')
      if (problem) { setWriteError(problem); setSavingProduct(false); return }
      setProducts(prev => prev.map(p => p.id === editProductId ? { ...p, ...tidy } : p))
    } else {
      const payload = { ...tidy, lender_id: productModal.lenderId }
      const { data, error } = await supabase.from('lender_products').insert(payload).select().single()
      if (error || !data) {
        setWriteError('That product was not saved - ' + (error?.message || 'the database refused it.'))
        setSavingProduct(false); return
      }
      setProducts(prev => [...prev, data])
    }
    setWriteError('')
    setProductModal(null)
    setEditProductId(null)
    setSavingProduct(false)
  }

  async function toggleProductActive(id: string, active: boolean) {
    const problem = await checkedWrite(
      supabase.from('lender_products').update({ active: !active }).eq('id', id), 'That product')
    if (problem) { setWriteError(problem); return }
    setWriteError('')
    setProducts(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p))
    setArchiveAsk(null)
  }

  async function toggleProductDraft(id: string, isDraft: boolean) {
    const problem = await checkedWrite(
      supabase.from('lender_products').update({ is_draft: !isDraft }).eq('id', id), 'That product')
    if (problem) { setWriteError(problem); return }
    setWriteError('')
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_draft: !isDraft } : p))
  }

  function toggleExpand(id: string) {
    const opening = !expanded.has(id)
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    // fire-and-forget: a missing Used by count greys one cell, and the page
    // must open at once rather than wait on a count per product.
    if (opening) countUsesFor(lenderProducts(id).map(x => x.id))
  }

  function lenderProducts(lenderId: string) {
    return products.filter(p => p.lender_id === lenderId)
  }

  // THE THREE TICKS AT THE TOP DECIDE WHAT IS DRAWN, and Find narrows it
  // further. A bank whose name matches keeps all its products; otherwise only
  // the products whose own name matches are shown, so searching a product name
  // does not hide it behind a bank that does not match.
  function matches(text: string) {
    const q = find.trim().toLowerCase()
    return !q || String(text || '').toLowerCase().includes(q)
  }

  function shownProducts(lender: Lender) {
    const all = lenderProducts(lender.id)
    const byTick = all.filter(x => x.active || showArchived)
    return matches(lender.name) ? byTick : byTick.filter(x => matches(x.product_name))
  }

  function shownLenders() {
    return lenders.filter(l => {
      if (!l.active && !showArchived) return false
      if (matches(l.name)) return true
      return lenderProducts(l.id).some(x => (x.active || showArchived) && matches(x.product_name))
    })
  }

  const liveCount = products.filter(x => x.active && !x.is_draft).length
  const draftCount = products.filter(x => x.active && x.is_draft).length
  const archivedCount = products.filter(x => !x.active).length
    + lenders.filter(l => !l.active).length
  const bankCount = lenders.filter(l => l.active).length

  function usesLabel(id: string) {
    const n = usedBy[id]
    if (n === undefined || n < 0) return ''
    if (n === 0) return 'none'
    return `${n} ${n === 1 ? 'deal' : 'deals'}`
  }

  function rateTypeLabel(x: Product) {
    return x.rate_type === 'variable' ? 'Variable' : x.rate_type === 'fixed' ? 'Fixed' : 'Variable + Fixed'
  }
  function purposeLabel(x: Product) {
    return x.loan_purpose === 'oo' ? 'OO only' : x.loan_purpose === 'investment' ? 'INV only' : 'OO + INV'
  }
  function offsetLabelOf(x: Product) {
    return x.offset_account ? (x.multiple_offsets ? 'Multiple offsets' : 'Offset') : 'No offset'
  }

  // A FEE CELL SAYS WHICH KIND OF NOTHING IT IS.
  // Blank and zero are not the same thing and the old line could not tell them
  // apart - both simply vanished. $0 is a bank that charges nothing; an empty
  // column is a figure nobody has recorded, and the client email prints a dash
  // where a number should be. The second one is a job, so it is marked.
  function feeCell(val: string) {
    const v = String(val ?? '').trim()
    if (!v) return <span className="text-[10px] font-semibold bg-chase-bg text-chase border border-chase-edge px-1.5 py-0.5 rounded-full">blank</span>
    if (v === '0' || v.toLowerCase() === 'none') return '$0'
    return v.startsWith('$') ? v : `$${v}`
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
        early_repayment_fee: p.early_repayment_fee || '',
        discharge_fee: p.discharge_fee || '',
        legal_fee: p.legal_fee || '',
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

  useBusyWhile(loading)
  // THE SHAPE THIS PAGE IS ABOUT TO BE.
  // Four count tiles, a row of controls, then the banks. Drawn at the sizes
  // the real thing uses, so nothing jumps when the figures arrive. It used to
  // be the words "Loading lender library..." in small grey type at the top
  // left of an empty page.
  if (loading) return (
    <section className="mb-10" aria-busy="true">
      <div className="grid grid-cols-4 gap-2.5 mb-3 max-[900px]:grid-cols-2">
        {[0, 1, 2, 3].map(i => <SkelTile key={i} />)}
      </div>
      <div className="bg-card border border-card-line rounded-xl px-3.5 py-3 mb-3 flex items-center gap-3.5">
        <SkelLine w="w-[250px]" tall />
        <span className="flex-1" />
        <SkelLine w="w-32" tall />
        <SkelLine w="w-24" tall />
      </div>
      <div className="space-y-2">
        <SkelRows rows={5} cols={4} />
        <SkelPanel lines={1} head={false} />
        <SkelPanel lines={1} head={false} />
        <SkelPanel lines={1} head={false} />
      </div>
    </section>
  )

  return (
    <section className="mb-10">
      {writeError && (
        <div className="bg-chase-bg border border-chase-edge text-chase rounded-lg px-3 py-2 text-xs mb-3 flex items-start gap-2">
          <span className="flex-1">{writeError}</span>
          <button onClick={() => setWriteError('')} className="underline shrink-0">Dismiss</button>
        </div>
      )}
      {/* FOUR COUNTS, THEN ONE ROW OF CONTROLS.
          The page used to open on a bare list with the two buttons floating
          above it, and nothing said how much of the library was live, how much
          had never been checked, or how much was put away. */}
      <div className="grid grid-cols-4 gap-2.5 mb-3 max-[900px]:grid-cols-2">
        {[
          { n: liveCount, t: 'Products live', tone: 'text-done' },
          { n: draftCount, t: 'Still draft', tone: 'text-waiting' },
          { n: archivedCount, t: 'Archived', tone: 'text-faint' },
          { n: bankCount, t: 'Banks', tone: 'text-ink' },
        ].map(tile => (
          <div key={tile.t} className="bg-card border border-card-line rounded-xl px-3.5 py-2.5">
            <p className={`text-[25px] font-bold leading-none tabular-nums ${tile.tone}`}>{tile.n}</p>
            <p className="text-[11px] text-muted mt-0.5">{tile.t}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-card-line rounded-xl px-3.5 py-2.5 mb-3 flex items-center gap-3.5 flex-wrap">
        <input value={find} onChange={e => setFind(e.target.value)}
          placeholder="Find a bank or a product"
          className="w-[250px] max-w-full border border-field-line rounded-lg px-2.5 py-1.5 text-[12.5px] bg-field focus:outline-none focus:border-brand" />
        <span className="w-px self-stretch bg-line-soft" />
        {/* Live and Draft are always drawn; the tick that matters is Archived,
            which is off until somebody asks for it. */}
        <span className="text-[12px] text-body whitespace-nowrap">Live and draft are always shown</span>
        <label className="text-[12px] text-body inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Also show archived
        </label>
        <span className="flex-1" />
        <button onClick={openImport} className="text-[12.5px] text-brand-ink border border-brand rounded-lg px-3 py-1.5 hover:bg-info-bg transition whitespace-nowrap">
          ✦ Import via AI
        </button>
        <button onClick={() => { setShowAddLender(true); setNewLenderName('') }} className="text-[12.5px] text-ink border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition whitespace-nowrap">
          + Add a bank
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        A fee that moved, or one new product: open the bank and press <span className="font-medium text-gray-500">Edit</span>.
        A whole new rate sheet: <span className="font-medium text-gray-500">Import</span> it, and everything it finds arrives as a draft for you to check.
        Nothing here is ever deleted &mdash; see <span className="font-medium text-gray-500">Archive</span>.
      </p>

      {showAddLender && (
        <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
          <p className="text-sm font-medium text-ink mb-3">New lender</p>
          <div className="flex gap-2">
            <input className={inp + ' flex-1'} placeholder="Lender name e.g. Westpac" value={newLenderName} onChange={e => setNewLenderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLender()} autoFocus />
            <button onClick={addLender} disabled={savingLender || !newLenderName.trim()} className="bg-ink text-page text-sm px-4 py-2 rounded-lg disabled:opacity-40">{savingLender ? 'Saving...' : 'Save'}</button>
            <button onClick={() => setShowAddLender(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {shownLenders().map(lender => {
          const lps = shownProducts(lender)
          const isOpen = expanded.has(lender.id)
          const archivedHere = lenderProducts(lender.id).filter(x => !x.active).length
          const asking = archiveAsk && archiveAsk.kind === 'lender' && archiveAsk.id === lender.id
          return (
            <div key={lender.id} className="border border-card-line rounded-xl bg-card overflow-hidden">
              {/* THE BANK WEARS ITS STATE ON A STRIP, the same device the
                  settlement blocks took on 6 Oct. Blue for a bank in use, grey
                  for one that is archived - and the name is the widest thing on
                  the strip, not a line of grey detail underneath it. */}
              <div className={`flex items-center gap-3 px-3.5 py-2 border-b cursor-pointer transition ${
                  lender.active ? 'bg-info-bg border-info-edge text-info hover:opacity-90'
                                : 'bg-gray-50 border-line text-faint hover:opacity-90'}`}
                onClick={() => toggleExpand(lender.id)}>
                <span className={`text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                <span className="text-[13.5px] font-bold uppercase tracking-[.02em] truncate flex-1 min-w-0">{lender.name}</span>
                {!lender.active && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-faint border border-line whitespace-nowrap">Archived</span>}
                <span className="text-[11px] opacity-85 truncate max-[1100px]:hidden">
                  {lps.length} product{lps.length !== 1 ? 's' : ''}
                  {archivedHere ? ` · ${archivedHere} archived` : ''}
                  {' · '}{legalFeeLabel(lender)}
                  {!confirmedFeeLabel(lender) && <span className="text-chase"> (not checked)</span>}
                </span>
                <span onClick={e => e.stopPropagation()}>
                  {lender.active
                    ? <button onClick={() => askArchiveLender(lender)} className="text-[11px] border border-card-line text-faint rounded px-2 py-0.5 hover:text-ink whitespace-nowrap">Archive bank</button>
                    : <button onClick={() => toggleLenderActive(lender.id, lender.active)} className="text-[11px] border border-done-edge text-done rounded px-2 py-0.5 hover:bg-done-bg whitespace-nowrap">Bring back</button>}
                </span>
              </div>
              {asking && (
                <div className="bg-gray-50 border-b border-line-soft px-4 py-3">
                  <p className="text-[13.5px] font-bold text-ink mb-1.5">Archive {lender.name}?</p>
                  <p className="text-[12px] text-muted leading-relaxed mb-1">· the bank and all its products come off every loan options list</p>
                  <p className="text-[12px] text-muted leading-relaxed mb-1">
                    · {archiveAsk.holds ? `the ${archiveAsk.holds} that used it stay exactly as they are` : 'anything that already used it stays exactly as it is'}
                  </p>
                  <p className="text-[12px] text-muted leading-relaxed mb-3">· one button brings the whole bank back, products and all</p>
                  <div className="flex gap-2">
                    <button onClick={() => toggleLenderActive(lender.id, lender.active)} className="text-[12px] bg-brand text-on-brand font-semibold rounded-lg px-3 py-1.5 hover:opacity-90">Archive the bank</button>
                    <button onClick={() => setArchiveAsk(null)} className="text-[12px] text-muted rounded-lg px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              )}
              {isOpen && (
                <div className="border-t border-gray-100">
                  {/* One setting for the whole bank, so the wording does not have
                      to be fixed product by product. */}
                  {/* TWO KINDS OF CONTENT, TWO STRIPS.
                      *
                      * 7 Oct 2026. Everything below used to run together: the
                      * questions we have learned about this bank, then its
                      * products, then an Add link, with nothing between them but
                      * a hairline. The questions are policy - asked once, used by
                      * every template after. The products are a list somebody
                      * edits daily. Same device Settlements took on 6 Oct, and
                      * the same rule as "a group of fields is a card with a grey
                      * header strip". Nothing is added, removed or reordered. */}
                  <div className="px-5 py-2 border-b flex items-baseline gap-2.5 flex-wrap bg-info-bg border-info-edge text-info">
                    <span className="text-[10px] font-bold uppercase tracking-[.08em]">What we have learned</span>
                    <span className="text-[11px] opacity-80">asked once, used by every template after</span>
                  </div>
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs text-gray-500">This bank calls the settlement charge</span>
                    {/* The value is the lender's own setting, NOT what it falls
                        back to. Showing the fallback here made the two states
                        look identical, so a lender already reading "Settlement
                        fee" could not be confirmed - picking the value it was
                        already showing is not a change, and nothing saved.
                        Fabio, 3 Sep 2026: "I can't mark checked on the ones that
                        I confirmed the wording. So what's the point of that?" */}
                    <select value={lender.legal_fee_label || ''}
                      onChange={e => setLegalFeeLabel(lender.id, e.target.value)}
                      className={`text-xs border rounded-lg px-2 py-1 bg-card ${
                        confirmedFeeLabel(lender) ? 'border-gray-200 text-ink' : 'border-dashed border-field-line text-muted'}`}>
                      <option value="">Not checked — uses {DEFAULT_LEGAL_FEE_LABEL}</option>
                      <option value="Settlement fee">Settlement fee</option>
                      <option value="Legal fee">Legal fee</option>
                    </select>
                    <span className="text-[11px] text-gray-400">
                      Used on the lending options email, the fact find and the handover.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-5 py-2.5 border-t border-gray-50 flex-wrap"
                       onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-gray-500">On a bank statement this bank shows up as</span>
                    <input defaultValue={lender.statement_codes || ''}
                      onBlur={e => { if (e.target.value !== (lender.statement_codes || '')) setStatementCodes(lender.id, e.target.value) }}
                      placeholder="CBA, CommBank"
                      className={`text-xs border rounded-lg px-2 py-1 bg-card w-[200px] ${
                        lender.statement_codes ? 'border-gray-200 text-ink' : 'border-dashed border-field-line text-muted placeholder:text-muted'}`} />
                    <span className="text-[11px] text-gray-400">
                      Separate several with commas. Used to tell whether a client&rsquo;s statements already cover this bank.
                    </span>
                  </div>
                  {/* WHEN THE LOAN MOVES. Fabio, 27 Sep 2026: 10% is a St George,
                      Westpac and Bank of Melbourne rule and nobody else's. Every
                      other bank sits at N/A until somebody types a figure, and the
                      deal says so rather than borrowing the common rule. Up or
                      down, percentage only. See lib/offer-accepted-rules.ts. */}
                  <div className="flex items-center gap-2 px-5 py-2.5 border-t border-gray-50 flex-wrap"
                       onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-gray-500">Wants the pricing redone if the loan moves more than</span>
                    <input defaultValue={lender.reprice_over_percent ?? ''}
                      key={`rp${lender.id}${lender.reprice_over_percent ?? ''}`}
                      onBlur={e => {
                        const was = lender.reprice_over_percent ?? ''
                        if (e.target.value.trim() !== String(was)) setRepriceOver(lender.id, e.target.value)
                      }}
                      placeholder="N/A"
                      className={`text-xs border rounded-lg px-2 py-1 bg-card w-[64px] text-right ${
                        lender.reprice_over_percent === null || lender.reprice_over_percent === undefined
                          ? 'border-gray-200 text-gray-400 placeholder:text-gray-300'
                          : 'border-gray-200 text-ink'}`} />
                    <span className="text-xs text-gray-500">%</span>
                    <span className="text-[11px] text-gray-400">
                      Up or down. Leave it blank where there is no rule &mdash; the deal then says to check, rather than assuming.
                    </span>
                  </div>
                  {/* WHEN DOES THIS BANK'S CHANGE START.
                      Only while a notice is running - the rest of the year there
                      is nothing to ask and the row is not there. The notice runs
                      on this lender's client emails up to this date and stops on
                      it, by itself. See lib/rate-notice.ts. */}
                  {notice.on && (
                    <div className="flex items-center gap-2 px-5 py-2.5 border-t border-gray-50 flex-wrap"
                         onClick={e => e.stopPropagation()}>
                      <span className="text-xs text-gray-500">
                        Their change from the {niceDate(notice.decisionDate)} decision takes effect on
                      </span>
                      <input type="date"
                        defaultValue={announcedFrom(lender, notice)}
                        key={`rn${lender.id}${announcedFrom(lender, notice)}`}
                        onBlur={e => {
                          if (e.target.value !== announcedFrom(lender, notice)) setEffectiveFrom(lender.id, e.target.value)
                        }}
                        className={`text-xs border rounded-lg px-2 py-1 bg-card ${
                          announcedFrom(lender, notice)
                            ? 'border-gray-200 text-ink'
                            : 'border-dashed border-field-line text-muted'}`} />
                      <span className="text-[11px] text-gray-400">
                        {!announcedFrom(lender, notice)
                          ? 'Not announced yet \u2014 their client emails carry the notice until a date is here.'
                          : hasTakenEffect(lender, notice)
                            ? `In force \u2014 the notice is off their emails${lender.rate_notice_by ? `, date set by ${lender.rate_notice_by}` : ''}.`
                            : `Their emails carry the notice until then, and stop on their own${lender.rate_notice_by ? ` \u2014 set by ${lender.rate_notice_by}` : ''}.`}
                      </span>
                    </div>
                  )}
                  <div className="px-5 py-2 border-b flex items-baseline gap-2.5 flex-wrap bg-gray-50 border-line text-muted">
                    <span className="text-[10px] font-bold uppercase tracking-[.08em]">Products</span>
                    <span className="text-[11px] opacity-80">{lps.length === 1 ? '1 product' : `${lps.length} products`}</span>
                  </div>
                  {lps.length === 0 && <p className="text-xs text-gray-400 px-5 py-3">No products yet.</p>}
                  {/* A TABLE, NOT A RUN-ON LINE.
                      Every product used to be its name followed by type,
                      purpose and the fees strung together in one grey sentence,
                      which meant you could not read down a column and the name
                      wrapped the moment the page narrowed. Fixed widths, the
                      name takes a quarter of them, and a long one ends in an
                      ellipsis rather than folding under its own chip. */}
                  {lps.length > 0 && (
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr className="text-[9.5px] font-bold uppercase tracking-[.075em] text-faint text-left">
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[26%]">Product</th>
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[9%]">Type</th>
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[8%]">Purpose</th>
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[7%] text-right">App</th>
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[7%] text-right">Annual</th>
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[8%] text-right">Valuation</th>
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[11%]">Offset</th>
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[8%]">Used by</th>
                        <th className="font-bold px-2.5 py-2 border-b border-line-soft w-[16%]" />
                      </tr>
                    </thead>
                    <tbody>
                      {lps.map(product => {
                        const askingThis = archiveAsk && archiveAsk.kind === 'product' && archiveAsk.id === product.id
                        const td = 'px-2.5 py-2.5 border-b border-line-soft text-[12.5px] text-body whitespace-nowrap truncate'
                        return (
                          <Fragment key={product.id}>
                          <tr className={`${!product.active ? 'opacity-50' : ''} ${askingThis ? 'bg-chase-bg' : ''}`}>
                            <td className={td + ' text-ink font-semibold'}>
                              {product.product_name}
                              {product.is_draft
                                ? <span className="ml-1.5 align-middle text-[10px] font-semibold bg-gray-100 text-muted border border-line px-1.5 py-0.5 rounded-full">Draft</span>
                                : !product.active
                                  ? <span className="ml-1.5 align-middle text-[10px] font-semibold bg-gray-100 text-faint border border-line px-1.5 py-0.5 rounded-full">Archived</span>
                                  : <span className="ml-1.5 align-middle text-[10px] font-semibold bg-done-bg text-done border border-done-edge px-1.5 py-0.5 rounded-full">Live</span>}
                            </td>
                            <td className={td}>{rateTypeLabel(product)}</td>
                            <td className={td}>{purposeLabel(product)}</td>
                            <td className={td + ' text-right tabular-nums'}>{feeCell(product.application_fee)}</td>
                            <td className={td + ' text-right tabular-nums'}>{feeCell(product.annual_fee)}</td>
                            <td className={td + ' text-right tabular-nums'}>{feeCell(product.valuation_fee)}</td>
                            <td className={td}>{offsetLabelOf(product)}</td>
                            <td className={td + ' text-faint'}>{usesLabel(product.id)}</td>
                            <td className="px-2.5 py-2.5 border-b border-line-soft">
                              <div className="flex gap-1.5 justify-end">
                                {product.active && (
                                  <button onClick={() => toggleProductDraft(product.id, product.is_draft)} className={`text-[11px] border rounded px-2 py-0.5 transition whitespace-nowrap ${product.is_draft ? 'border-done-edge text-done hover:bg-done-bg' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{product.is_draft ? 'Go live' : 'Set draft'}</button>
                                )}
                                <button onClick={() => openEditProduct(product, lender.name)} className="text-[11px] border border-field-line text-muted rounded px-2 py-0.5 hover:text-ink transition whitespace-nowrap">Edit</button>
                                {product.active
                                  ? <button onClick={() => askArchiveProduct(product)} className="text-[11px] border border-card-line text-faint rounded px-2 py-0.5 hover:text-ink transition whitespace-nowrap">Archive</button>
                                  : <button onClick={() => toggleProductActive(product.id, product.active)} className="text-[11px] border border-done-edge text-done rounded px-2 py-0.5 hover:bg-done-bg transition whitespace-nowrap">Bring back</button>}
                              </div>
                            </td>
                          </tr>
                          {askingThis && (
                            <tr>
                              <td colSpan={9} className="bg-gray-50 border-b border-line-soft px-4 py-3">
                                <p className="text-[13.5px] font-bold text-ink mb-1.5">Archive {product.product_name}?</p>
                                <p className="text-[12px] text-muted leading-relaxed mb-1">· it comes off the product list on every new loan options screen</p>
                                <p className="text-[12px] text-muted leading-relaxed mb-1">
                                  · {archiveAsk.holds && archiveAsk.holds !== '0 deals'
                                      ? `the ${archiveAsk.holds} that already chose it stay exactly as they are`
                                      : 'anything that already chose it stays exactly as it is'}
                                </p>
                                <p className="text-[12px] text-muted leading-relaxed mb-3">· one button brings it back</p>
                                <p className="text-[12px] text-muted leading-relaxed mb-3">
                                  <span className="font-semibold text-ink">We archive, we never delete.</span> Deleting would break the deals that used it, and there is no undo.
                                </p>
                                <div className="flex gap-2">
                                  <button onClick={() => toggleProductActive(product.id, product.active)} className="text-[12px] bg-brand text-on-brand font-semibold rounded-lg px-3 py-1.5 hover:opacity-90">Archive it</button>
                                  <button onClick={() => setArchiveAsk(null)} className="text-[12px] text-muted rounded-lg px-3 py-1.5">Cancel</button>
                                </div>
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                  )}
                  <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                    <button onClick={() => openAddProduct(lender.id, lender.name)} className="text-xs text-brand-ink hover:underline">+ Add product</button>
                    {!showArchived && archivedHere > 0 && (
                      <span className="text-[11.5px] text-faint">
                        {archivedHere} archived {archivedHere === 1 ? 'product is' : 'products are'} hidden &mdash; tick &ldquo;Also show archived&rdquo; at the top
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {lenders.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No lenders yet. Add your first lender above.</p>}

      {/* THERE IS NO DELETE MODAL ANY MORE.
          7 Oct 2026. It used the word permanent about a product that any
          number of deals could be pointing at, and about a bank the database
          would then refuse to remove anyway. Archive replaced both, the two
          delete functions went with it, and nothing on this screen can now
          take a row out of the database. */}
      {/* AI Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-semibold text-ink">{importStep === 'input' ? '✦ Import via AI' : 'Review extracted products'}</p>
                <p className="text-xs text-gray-400">{importStep === 'input' ? 'Upload a PDF or paste a URL to extract lender products' : 'Select which products to save — all start as draft'}</p>
              </div>
              <button onClick={() => setImportModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {importStep === 'input' && (
              <>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-4">
                  <button onClick={() => setImportTab('pdf')} className={`flex-1 py-2 text-sm transition ${importTab === 'pdf' ? 'bg-ink text-page' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Upload PDF</button>
                  <button onClick={() => setImportTab('url')} className={`flex-1 py-2 text-sm transition ${importTab === 'url' ? 'bg-ink text-page' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Paste URL</button>
                </div>
                {importTab === 'pdf' && (
                  <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand hover:bg-info-bg/20 transition mb-4">
                    <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                    {importFile ? (
                      <div>
                        <p className="text-sm font-medium text-ink">{importFile.name}</p>
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
                {extractError && <p className="text-sm text-chase mb-3">{extractError}</p>}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button onClick={() => setImportModal(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                  <button onClick={runExtraction} disabled={extracting || (importTab === 'pdf' ? !importFile : !importUrl.trim())} className="bg-brand text-on-brand text-sm px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
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
                  <p className="text-xs text-gray-400 mt-1">AI detected: <span className="font-medium text-ink">{extractedProducts[0]?.lender_name || 'Unknown'}</span> · Change if incorrect</p>
                </div>
                <div className="space-y-2 mb-4">
                  {extractedProducts.map((p, i) => (
                    <div key={i} onClick={() => setExtractedProducts(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                      className={`border rounded-xl p-3 cursor-pointer transition ${p.selected ? 'border-brand bg-info-bg' : 'border-gray-200 opacity-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-ink">{p.product_name}</p>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${p.selected ? 'bg-brand border-brand' : 'border-gray-300'}`}>
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
                <p className="text-xs text-gray-400 mb-4">All saved products start as <span className="text-gray-600 font-medium">Draft</span> — go live from the library after reviewing.</p>
                {extractError && <p className="text-sm text-chase mb-3">{extractError}</p>}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button onClick={() => setImportStep('input')} className="text-sm text-gray-400 hover:text-gray-600 px-3">Back</button>
                  <button onClick={saveImport} disabled={savingImport || !extractedProducts.some(p => p.selected)} className="bg-ink text-page text-sm px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-40">
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
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-semibold text-ink">{editProductId ? 'Edit product' : 'Add product'}</p>
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
                    <input className={inp} value={productForm.application_fee} onChange={e => setProductForm({...productForm, application_fee: e.target.value})} onBlur={e => setProductForm(f => ({...f, application_fee: feeText(e.target.value)}))} placeholder="e.g. $250" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Annual / ongoing fee</label>
                    <input className={inp} value={productForm.annual_fee} onChange={e => setProductForm({...productForm, annual_fee: e.target.value})} onBlur={e => setProductForm(f => ({...f, annual_fee: feeText(e.target.value)}))} placeholder="e.g. $395/yr or None" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Valuation fee</label>
                    <input className={inp} value={productForm.valuation_fee} onChange={e => setProductForm({...productForm, valuation_fee: e.target.value})} onBlur={e => setProductForm(f => ({...f, valuation_fee: feeText(e.target.value)}))} placeholder="e.g. Free up to $360" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">{legalFeeLabel(lenders.find(l => l.id === productModal.lenderId))}</label>
                    <input className={inp} value={productForm.legal_fee} onChange={e => setProductForm({...productForm, legal_fee: e.target.value})} onBlur={e => setProductForm(f => ({...f, legal_fee: feeText(e.target.value)}))} placeholder="e.g. $150, or None — government fees only" />
                  </div>
                  {(productForm.rate_type === 'fixed' || productForm.rate_type === 'both') && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Rate lock fee</label>
                      <input className={inp} value={productForm.rate_lock_fee} onChange={e => setProductForm({...productForm, rate_lock_fee: e.target.value})} onBlur={e => setProductForm(f => ({...f, rate_lock_fee: feeText(e.target.value)}))} placeholder="e.g. $500" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2 mt-4">Cost to exit</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Early repayment fee</label>
                    <input className={inp} value={productForm.early_repayment_fee} onChange={e => setProductForm({...productForm, early_repayment_fee: e.target.value})} onBlur={e => setProductForm(f => ({...f, early_repayment_fee: feeText(e.target.value)}))} placeholder="e.g. Break cost on fixed, or None" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Discharge fee</label>
                    <input className={inp} value={productForm.discharge_fee} onChange={e => setProductForm({...productForm, discharge_fee: e.target.value})} onBlur={e => setProductForm(f => ({...f, discharge_fee: feeText(e.target.value)}))} placeholder="e.g. $350" />
                  </div>
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
              <button onClick={saveProduct} disabled={savingProduct || !productForm.product_name.trim()} className="bg-ink text-page text-sm px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-40">
                {savingProduct ? 'Saving...' : editProductId ? 'Update product' : 'Save product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
