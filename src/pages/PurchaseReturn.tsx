import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adjustStock } from '../lib/inventory'
import type { Purchase, PurchaseReturn as PRRow, LineItem } from '../lib/types'
import { inr, today, shortDate } from '../lib/format'
import { Card, PageHeader, Pill, Field, Input, Select, Empty } from '../components/ui'

const blank = (): LineItem => ({ name: '', qty: 1, rate: 0 })

export default function PurchaseReturn() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [purchaseId, setPurchaseId] = useState('')
  const [reason, setReason] = useState('Damaged / Defective')
  const [date, setDate] = useState(today())
  const [items, setItems] = useState<LineItem[]>([blank()])
  const [history, setHistory] = useState<PRRow[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    supabase.from('purchases').select('*').order('created_at', { ascending: false }).then(({ data }) => setPurchases((data as Purchase[]) ?? []))
    supabase.from('purchase_returns').select('*').order('created_at', { ascending: false }).limit(8).then(({ data }) => setHistory((data as PRRow[]) ?? []))
  }
  useEffect(load, [])

  const selectedPurchase = purchases.find((p) => p.id === purchaseId)
  const subtotal = useMemo(() => items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0), [items])

  function pickPurchase(id: string) {
    setPurchaseId(id)
    const p = purchases.find((x) => x.id === id)
    if (p && p.items.length) setItems(p.items.map((it) => ({ ...it })))
  }
  function setItem(idx: number, patch: Partial<LineItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function save() {
    setError(null); setMsg(null)
    const clean = items.filter((it) => it.name.trim() && Number(it.qty) > 0)
    if (clean.length === 0) return setError('Add at least one item to return.')
    setSaving(true)
    try {
      const { error: e } = await supabase.from('purchase_returns').insert({
        purchase_id: purchaseId || null,
        supplier: selectedPurchase?.supplier ?? null,
        reason,
        items: clean,
        total: subtotal,
        date,
      })
      if (e) throw e
      await adjustStock(clean, -1)
      setMsg('Return recorded and stock reduced ✅')
      setItems([blank()]); setPurchaseId('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record return.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Purchase Return"
        sub="Return damaged or excess stock to suppliers"
        actions={<button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Record Return'}</button>}
      />
      {error && <div className="alert-strip a-red">{error}</div>}
      {msg && <div className="alert-strip a-green">{msg}</div>}
      <div className="g-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Return Details">
            <div className="form-row">
              <Field label="Original Purchase">
                <Select value={purchaseId} onChange={(e) => pickPurchase(e.target.value)}>
                  <option value="">Select purchase…</option>
                  {purchases.map((p) => (
                    <option key={p.id} value={p.id}>{p.supplier} · {p.bill_no ?? shortDate(p.date)} · {inr(p.total)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason">
                <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option>Damaged / Defective</option><option>Wrong Item</option><option>Excess Stock</option><option>Quality Issue</option>
                </Select>
              </Field>
            </div>
            <Field label="Return Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </Card>

          <Card title="Items to Return">
            <div className="items-adder">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 30px', gap: 8, marginBottom: 8 }}>
                {['Item', 'Qty', 'Rate', ''].map((h) => (<span key={h} style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{h}</span>))}
              </div>
              {items.map((it, i) => (
                <div className="item-row no-amt" key={i}>
                  <Input value={it.name} placeholder="Item" onChange={(e) => setItem(i, { name: e.target.value })} />
                  <Input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                  <Input type="number" min={0} value={it.rate} onChange={(e) => setItem(i, { rate: Number(e.target.value) })} />
                  <button className="del-btn" onClick={() => setItems((a) => (a.length === 1 ? a : a.filter((_, j) => j !== i)))}>✕</button>
                </div>
              ))}
              <button className="add-item-btn" onClick={() => setItems((a) => [...a, blank()])}>＋ Add Item</button>
            </div>
          </Card>

          <Card title="Return History">
            {history.length === 0 ? <Empty>No returns recorded yet.</Empty> : (
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr><th>Date</th><th>Supplier</th><th>Reason</th><th className="r">Amount</th></tr></thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}><td>{shortDate(h.date)}</td><td>{h.supplier ?? '—'}</td><td>{h.reason ?? '—'}</td><td className="r">{inr(h.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Return Summary" sticky>
            <div className="sum-row"><span>Return Qty</span><span>{items.reduce((s, it) => s + Number(it.qty || 0), 0)}</span></div>
            <div className="sum-row total"><span>Credit Note Value</span><span>{inr(subtotal)}</span></div>
            <div style={{ marginTop: 12 }}><Pill tone="gold">Stock will reduce on save</Pill></div>
          </Card>
        </div>
      </div>
    </>
  )
}
