import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adjustStock } from '../lib/inventory'
import type { Purchase as PurchaseRow, LineItem, Supplier } from '../lib/types'
import { inr, today, shortDate } from '../lib/format'
import { Card, PageHeader, Pill, Field, Input, Select, Empty } from '../components/ui'
import SuccessModal from '../components/SuccessModal'

const CATEGORIES = ['Fabric', 'Readymade', 'Stitching', 'Accessories', 'Service', 'Uncategorised']
const blank = (): LineItem => ({ name: '', qty: 1, rate: 0, category: 'Fabric' })

export default function Purchase() {
  const [supplier, setSupplier] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [billNo, setBillNo] = useState('')
  const [date, setDate] = useState(today())
  const [paymentMode, setPaymentMode] = useState('Credit (Due)')
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate, setTaxRate] = useState(5)
  const [items, setItems] = useState<LineItem[]>([blank()])
  const [recent, setRecent] = useState<PurchaseRow[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ supplier: string; total: number; edit: boolean } | null>(null)
  // When set, we are editing an existing purchase rather than creating a new one.
  // originalItems is the snapshot of what was saved, so stock only moves by the delta.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [originalItems, setOriginalItems] = useState<LineItem[]>([])
  const [viewing, setViewing] = useState<PurchaseRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function load() {
    supabase
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setRecent((data as PurchaseRow[]) ?? []))
  }
  function loadSuppliers() {
    supabase
      .from('suppliers')
      .select('*')
      .order('name')
      .then(({ data }) => setSuppliers((data as Supplier[]) ?? []))
  }
  useEffect(() => { load(); loadSuppliers() }, [])

  const supplierSuggestions = suppliers.filter(
    (s) =>
      supplier.length > 0 &&
      (s.name.toLowerCase().includes(supplier.toLowerCase()) || (s.phone ?? '').includes(supplier))
  )

  function pickSupplier(s: Supplier) {
    setSupplier(s.name)
    setSupplierPhone(s.phone ?? '')
    setShowSuggest(false)
  }

  // Auto-save a new vendor (or refresh phone for an existing one) so they're
  // searchable next time. Matched case-insensitively by name.
  async function upsertSupplier(name: string, phone: string) {
    const existing = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (phone && phone !== (existing.phone ?? '')) {
        await supabase.from('suppliers').update({ phone }).eq('id', existing.id)
      }
      return
    }
    await supabase.from('suppliers').insert({ name, phone: phone || null })
    loadSuppliers()
  }

  const subtotal = useMemo(() => items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0), [items])
  const taxAmount = useMemo(() => (taxEnabled ? Math.round(subtotal * (Number(taxRate) || 0)) / 100 : 0), [subtotal, taxEnabled, taxRate])
  const grandTotal = subtotal + taxAmount

  function setItem(idx: number, patch: Partial<LineItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function resetForm() {
    setEditingId(null)
    setOriginalItems([])
    setSupplier(''); setSupplierPhone(''); setShowSuggest(false); setBillNo(''); setItems([blank()]); setPaymentMode('Credit (Due)'); setDate(today())
    setTaxEnabled(false); setTaxRate(5)
  }

  function startEdit(p: PurchaseRow) {
    setError(null); setMsg(null)
    setEditingId(p.id)
    setOriginalItems(p.items ?? [])
    setSupplier(p.supplier)
    setSupplierPhone(p.supplier_phone ?? '')
    setBillNo(p.bill_no ?? '')
    setDate(p.date)
    setPaymentMode(p.payment_mode)
    setTaxEnabled(Number(p.tax_rate) > 0)
    setTaxRate(Number(p.tax_rate) > 0 ? Number(p.tax_rate) : 5)
    setItems(p.items?.length ? p.items.map((it) => ({ ...it })) : [blank()])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deletePurchase(p: PurchaseRow) {
    if (!window.confirm(`Delete this purchase from ${p.supplier}? Its stock will be removed from inventory.`)) return
    setError(null); setMsg(null)
    setDeletingId(p.id)
    try {
      const { error: e } = await supabase.from('purchases').delete().eq('id', p.id)
      if (e) throw e
      // Reverse the stock this purchase had added.
      await adjustStock(p.items ?? [], -1)
      if (editingId === p.id) resetForm()
      setMsg('Purchase deleted and stock reversed ✅')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete purchase.')
    } finally {
      setDeletingId(null)
    }
  }

  async function save() {
    setError(null); setMsg(null)
    const clean = items.filter((it) => it.name.trim() && Number(it.qty) > 0)
    if (!supplier.trim()) return setError('Enter a supplier name.')
    if (clean.length === 0) return setError('Add at least one item.')
    setSaving(true)
    try {
      const status = paymentMode.toLowerCase().includes('credit') || paymentMode.toLowerCase().includes('due') ? 'due' : 'paid'
      const payload = {
        supplier: supplier.trim(),
        supplier_phone: supplierPhone.trim() || null,
        bill_no: billNo.trim() || null,
        date,
        items: clean,
        total: grandTotal,
        tax_rate: taxEnabled ? Number(taxRate) || 0 : 0,
        tax_amount: taxAmount,
        payment_mode: paymentMode,
        status,
      }
      if (editingId) {
        const { error: e } = await supabase.from('purchases').update(payload).eq('id', editingId)
        if (e) throw e
        // Stock moves only by the delta: reverse what the old bill added, then add the new bill.
        await adjustStock(originalItems, -1)
        await adjustStock(clean, 1)
        setMsg('Purchase updated and stock adjusted ✅')
      } else {
        const { error: e } = await supabase.from('purchases').insert(payload)
        if (e) throw e
        await adjustStock(clean, 1)
        setMsg('Purchase saved and inventory updated ✅')
      }
      // Remember this vendor for future searches.
      await upsertSupplier(supplier.trim(), supplierPhone.trim())
      setSuccess({ supplier: supplier.trim(), total: grandTotal, edit: !!editingId })
      resetForm()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save purchase.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {success && (
        <SuccessModal
          title={success.edit ? 'Purchase Updated!' : 'Purchase Saved Successfully!'}
          subtitle="Stock has been updated in your inventory."
          details={[
            { label: 'Supplier', value: success.supplier },
            { label: 'Total Amount', value: inr(success.total) },
            { label: 'Date & Time', value: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
          ]}
          onClose={() => setSuccess(null)}
          actions={<button className="btn btn-gold" style={{ gridColumn: '1 / -1' }} onClick={() => setSuccess(null)}>Done</button>}
        />
      )}
      <PageHeader
        title={editingId ? 'Edit Purchase' : 'Purchase Entry'}
        sub={editingId ? 'Update this bill — stock moves only by the change' : 'Record stock purchased from suppliers'}
        actions={
          <>
            {editingId && <button className="btn btn-outline" onClick={resetForm} disabled={saving}>Cancel</button>}
            <button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Purchase' : 'Save Purchase'}</button>
          </>
        }
      />
      {error && <div className="alert-strip a-red">{error}</div>}
      {msg && <div className="alert-strip a-green">{msg}</div>}
      <div className="g-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Supplier Details">
            <div className="form-row">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Supplier Name</label>
                <Input
                  value={supplier}
                  placeholder="Search or add vendor…"
                  onChange={(e) => { setSupplier(e.target.value); setShowSuggest(true) }}
                  onFocus={() => setShowSuggest(true)}
                />
                {showSuggest && supplierSuggestions.length > 0 && (
                  <div
                    className="glass-card"
                    style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, padding: 6, maxHeight: 220, overflowY: 'auto' }}
                  >
                    {supplierSuggestions.slice(0, 6).map((s) => (
                      <div
                        key={s.id}
                        onClick={() => pickSupplier(s)}
                        style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <strong>{s.name}</strong>
                        {s.phone && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{s.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Field label="Supplier Phone"><Input value={supplierPhone} placeholder="+91…" onChange={(e) => setSupplierPhone(e.target.value)} /></Field>
            </div>
            <div className="form-row">
              <Field label="Invoice / Bill No."><Input value={billNo} onChange={(e) => setBillNo(e.target.value)} /></Field>
              <Field label="Purchase Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
            <div className="form-row">
              <Field label="Payment Mode">
                <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option>Credit (Due)</option><option>Cash</option><option>UPI</option><option>Bank Transfer</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Items Purchased">
            <div className="items-adder">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 0.8fr 1fr 30px', gap: 8, marginBottom: 8 }}>
                {['Item / Fabric', 'Category', 'Qty / Mtrs', 'Rate (₹)', ''].map((h) => (
                  <span key={h} style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {items.map((it, i) => (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 0.8fr 1fr 30px', gap: 8, marginBottom: 8, alignItems: 'center' }} key={i}>
                  <Input value={it.name} placeholder="Item name" onChange={(e) => setItem(i, { name: e.target.value })} />
                  <Select value={it.category ?? 'Fabric'} onChange={(e) => setItem(i, { category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                  <Input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                  <Input type="number" min={0} value={it.rate} onChange={(e) => setItem(i, { rate: Number(e.target.value) })} />
                  <button className="del-btn" onClick={() => setItems((a) => (a.length === 1 ? a : a.filter((_, j) => j !== i)))}>✕</button>
                </div>
              ))}
              <button className="add-item-btn" onClick={() => setItems((a) => [...a, blank()])}>＋ Add Item</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
                Add Tax (GST)
              </label>
              {taxEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Input type="number" min={0} step={0.5} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} style={{ width: 80 }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>% tax</span>
                </div>
              )}
            </div>
          </Card>

          <Card title="Recent Purchases">
            {recent.length === 0 ? (
              <Empty>No purchases recorded yet.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr><th>Date</th><th>Supplier</th><th>Bill No.</th><th className="r">Amount</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {recent.map((p) => (
                      <tr key={p.id} className={editingId === p.id ? 'is-editing' : ''}>
                        <td>{shortDate(p.date)}</td>
                        <td>{p.supplier}</td>
                        <td>{p.bill_no ?? '—'}</td>
                        <td className="r">{inr(p.total)}</td>
                        <td><Pill tone={p.status === 'paid' ? 'green' : 'gold'}>{p.status === 'paid' ? 'Paid' : 'Due'}</Pill></td>
                        <td className="r">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setViewing(p)}>View</button>
                            <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>Edit</button>
                            <button className="btn btn-outline btn-sm btn-danger" onClick={() => deletePurchase(p)} disabled={deletingId === p.id}>
                              {deletingId === p.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Purchase Summary" sticky>
            <div className="sum-row"><span>Items</span><span>{items.filter((i) => i.name.trim()).length}</span></div>
            <div className="sum-row"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
            {taxEnabled && <div className="sum-row"><span>Tax ({Number(taxRate) || 0}%)</span><span>{inr(taxAmount)}</span></div>}
            <div className="sum-row total"><span>Grand Total</span><span>{inr(grandTotal)}</span></div>
            <button className="btn btn-gold" style={{ width: '100%', marginTop: 14 }} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update & Adjust Stock' : 'Save & Update Stock'}
            </button>
            {supplier.trim() && !suppliers.some((s) => s.name.toLowerCase() === supplier.trim().toLowerCase()) && (
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
                New vendor “{supplier.trim()}” will be saved for next time
              </div>
            )}
          </Card>
        </div>
      </div>

      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{viewing.supplier}</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
                  {shortDate(viewing.date)} · Bill {viewing.bill_no ?? '—'} · {viewing.payment_mode}
                </div>
              </div>
              <button className="del-btn" onClick={() => setViewing(null)}>✕</button>
            </div>
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {(viewing.items ?? []).map((it, i) => (
                    <tr key={i}>
                      <td>{it.name}</td>
                      <td className="r">{it.qty}</td>
                      <td className="r">{inr(it.rate)}</td>
                      <td className="r">{inr(Number(it.qty) * Number(it.rate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12 }}>
              {Number(viewing.tax_amount) > 0 && (
                <div className="sum-row"><span>Tax ({Number(viewing.tax_rate)}%)</span><span>{inr(viewing.tax_amount)}</span></div>
              )}
              <div className="sum-row total"><span>Total</span><span>{inr(viewing.total)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { startEdit(viewing); setViewing(null) }}>Edit</button>
              <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
