import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adjustStock } from '../lib/inventory'
import type { Purchase as PurchaseRow, LineItem } from '../lib/types'
import { inr, today, shortDate } from '../lib/format'
import { Card, PageHeader, Pill, Field, Input, Select, Empty } from '../components/ui'

const blank = (): LineItem => ({ name: '', qty: 1, rate: 0 })

export default function Purchase() {
  const [supplier, setSupplier] = useState('')
  const [billNo, setBillNo] = useState('')
  const [date, setDate] = useState(today())
  const [paymentMode, setPaymentMode] = useState('Credit (Due)')
  const [items, setItems] = useState<LineItem[]>([blank()])
  const [recent, setRecent] = useState<PurchaseRow[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // When set, we are editing an existing purchase rather than creating a new one.
  // originalItems is the snapshot of what was saved, so stock only moves by the delta.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [originalItems, setOriginalItems] = useState<LineItem[]>([])

  function load() {
    supabase
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setRecent((data as PurchaseRow[]) ?? []))
  }
  useEffect(load, [])

  const subtotal = useMemo(() => items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0), [items])

  function setItem(idx: number, patch: Partial<LineItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function resetForm() {
    setEditingId(null)
    setOriginalItems([])
    setSupplier(''); setBillNo(''); setItems([blank()]); setPaymentMode('Credit (Due)'); setDate(today())
  }

  function startEdit(p: PurchaseRow) {
    setError(null); setMsg(null)
    setEditingId(p.id)
    setOriginalItems(p.items ?? [])
    setSupplier(p.supplier)
    setBillNo(p.bill_no ?? '')
    setDate(p.date)
    setPaymentMode(p.payment_mode)
    setItems(p.items?.length ? p.items.map((it) => ({ ...it })) : [blank()])
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        bill_no: billNo.trim() || null,
        date,
        items: clean,
        total: subtotal,
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
              <Field label="Supplier Name"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
              <Field label="Invoice / Bill No."><Input value={billNo} onChange={(e) => setBillNo(e.target.value)} /></Field>
            </div>
            <div className="form-row">
              <Field label="Purchase Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Payment Mode">
                <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option>Credit (Due)</option><option>Cash</option><option>UPI</option><option>Bank Transfer</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Items Purchased">
            <div className="items-adder">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 30px', gap: 8, marginBottom: 8 }}>
                {['Item / Fabric', 'Qty / Mtrs', 'Rate (₹)', ''].map((h) => (
                  <span key={h} style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {items.map((it, i) => (
                <div className="item-row no-amt" key={i}>
                  <Input value={it.name} placeholder="Item name" onChange={(e) => setItem(i, { name: e.target.value })} />
                  <Input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                  <Input type="number" min={0} value={it.rate} onChange={(e) => setItem(i, { rate: Number(e.target.value) })} />
                  <button className="del-btn" onClick={() => setItems((a) => (a.length === 1 ? a : a.filter((_, j) => j !== i)))}>✕</button>
                </div>
              ))}
              <button className="add-item-btn" onClick={() => setItems((a) => [...a, blank()])}>＋ Add Item</button>
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
                        <td className="r"><button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>Edit</button></td>
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
            <div className="sum-row total"><span>Grand Total</span><span>{inr(subtotal)}</span></div>
            <button className="btn btn-gold" style={{ width: '100%', marginTop: 14 }} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update & Adjust Stock' : 'Save & Update Stock'}
            </button>
          </Card>
        </div>
      </div>
    </>
  )
}
