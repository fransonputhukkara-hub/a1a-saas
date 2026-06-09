import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adjustStock } from '../lib/inventory'
import type { Invoice, SalesReturn as SRRow, LineItem } from '../lib/types'
import { inr, today, shortDate } from '../lib/format'
import { Card, PageHeader, Pill, Field, Input, Select, Empty } from '../components/ui'

const blank = (): LineItem => ({ name: '', qty: 1, rate: 0 })

export default function SalesReturn() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceId, setInvoiceId] = useState('')
  const [reason, setReason] = useState('Size Issue')
  const [refund, setRefund] = useState('Cash Refund')
  const [date, setDate] = useState(today())
  const [items, setItems] = useState<LineItem[]>([blank()])
  const [history, setHistory] = useState<SRRow[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    supabase.from('invoices').select('*').order('created_at', { ascending: false }).then(({ data }) => setInvoices((data as Invoice[]) ?? []))
    supabase.from('sales_returns').select('*').order('created_at', { ascending: false }).limit(8).then(({ data }) => setHistory((data as SRRow[]) ?? []))
  }
  useEffect(load, [])

  const selectedInvoice = invoices.find((i) => i.id === invoiceId)
  const subtotal = useMemo(() => items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0), [items])

  function pickInvoice(id: string) {
    setInvoiceId(id)
    const inv = invoices.find((x) => x.id === id)
    if (inv && inv.items.length) setItems(inv.items.map((it) => ({ ...it })))
  }
  function setItem(idx: number, patch: Partial<LineItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function save() {
    setError(null); setMsg(null)
    const clean = items.filter((it) => it.name.trim() && Number(it.qty) > 0)
    if (clean.length === 0) return setError('Add at least one returned item.')
    setSaving(true)
    try {
      const { error: e } = await supabase.from('sales_returns').insert({
        invoice_id: invoiceId || null,
        customer_id: selectedInvoice?.customer_id ?? null,
        customer_name: selectedInvoice?.customer_name ?? null,
        reason,
        refund_method: refund,
        items: clean,
        total: subtotal,
        date,
      })
      if (e) throw e
      // Returned goods come back into stock (unless it's a stitching service)
      await adjustStock(clean, 1)
      setMsg('Sales return processed ✅')
      setItems([blank()]); setInvoiceId('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process return.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Sales Return"
        sub="Process customer returns and issue credit notes"
        actions={<button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Process Return'}</button>}
      />
      {error && <div className="alert-strip a-red">{error}</div>}
      {msg && <div className="alert-strip a-green">{msg}</div>}
      <div className="g-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Return Details">
            <div className="form-row">
              <Field label="Original Invoice">
                <Select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)}>
                  <option value="">Select invoice…</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>#{inv.invoice_number} · {inv.customer_name} · {inr(inv.total)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason">
                <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option>Size Issue</option><option>Defective Item</option><option>Wrong Item</option><option>Customer Changed Mind</option>
                </Select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Return Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Refund Method">
                <Select value={refund} onChange={(e) => setRefund(e.target.value)}>
                  <option>Cash Refund</option><option>Store Credit</option><option>Exchange</option><option>UPI Refund</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Items Returned">
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
            {history.length === 0 ? <Empty>No sales returns yet.</Empty> : (
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr><th>Date</th><th>Customer</th><th>Method</th><th className="r">Amount</th></tr></thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}><td>{shortDate(h.date)}</td><td>{h.customer_name ?? '—'}</td><td><Pill tone="blue">{h.refund_method ?? '—'}</Pill></td><td className="r">{inr(h.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Credit Note Summary" sticky>
            <div className="sum-row"><span>Return Qty</span><span>{items.reduce((s, it) => s + Number(it.qty || 0), 0)}</span></div>
            <div className="sum-row total"><span>Credit Note Total</span><span>{inr(subtotal)}</span></div>
          </Card>
        </div>
      </div>
    </>
  )
}
