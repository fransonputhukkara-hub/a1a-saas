import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Customer, Invoice, InventoryItem, LineItem } from '../lib/types'
import { inr, today, whatsappLink, invoiceMessage } from '../lib/format'
import { useShop } from '../lib/ShopContext'
import { Card, PageHeader, Field, Input, Select } from '../components/ui'

const blankItem = (): LineItem => ({ name: '', qty: 1, rate: 0 })

export default function Sale() {
  const { shop } = useShop()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [scanCode, setScanCode] = useState('')
  const [scanMsg, setScanMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custId, setCustId] = useState<string | null>(null)
  const [showSuggest, setShowSuggest] = useState(false)

  const [deliveryDate, setDeliveryDate] = useState('')
  const [trialDate, setTrialDate] = useState('')
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<LineItem[]>([blankItem()])
  const [discount, setDiscount] = useState(0)
  const [advance, setAdvance] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('customers')
      .select('*')
      .order('name')
      .then(({ data }) => setCustomers((data as Customer[]) ?? []))
    supabase
      .from('inventory')
      .select('*')
      .then(({ data }) => setInventory((data as InventoryItem[]) ?? []))
  }, [])

  function handleScan(rawCode: string) {
    const code = rawCode.trim()
    if (!code) return
    const match = inventory.find(
      (it) =>
        (it.barcode && it.barcode.toLowerCase() === code.toLowerCase()) ||
        (it.sku && it.sku.toLowerCase() === code.toLowerCase())
    )
    if (!match) {
      setScanMsg({ tone: 'red', text: `No product found for "${code}"` })
      return
    }
    // Increment qty if already in the bill, otherwise add a new row.
    setItems((arr) => {
      const idx = arr.findIndex(
        (it) => it.name.toLowerCase() === match.name.toLowerCase() && Number(it.rate) === Number(match.selling_rate)
      )
      if (idx >= 0) {
        return arr.map((it, i) => (i === idx ? { ...it, qty: Number(it.qty) + 1 } : it))
      }
      const next = [...arr]
      // Replace a leading blank row if present, otherwise append.
      const blankIdx = next.findIndex((it) => !it.name.trim())
      const row: LineItem = { name: match.name, qty: 1, rate: Number(match.selling_rate) }
      if (blankIdx >= 0) next[blankIdx] = row
      else next.push(row)
      return next
    })
    setScanMsg({ tone: 'green', text: `Added: ${match.name} · ${inr(match.selling_rate)}` })
    setScanCode('')
    setTimeout(() => scanRef.current?.focus(), 0)
  }

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0),
    [items]
  )
  const total = Math.max(0, subtotal - Number(discount || 0))
  const balance = Math.max(0, total - Number(advance || 0))

  const suggestions = customers.filter(
    (c) =>
      custName.length > 0 &&
      (c.name.toLowerCase().includes(custName.toLowerCase()) ||
        (c.phone ?? '').includes(custName))
  )

  function pickCustomer(c: Customer) {
    setCustId(c.id)
    setCustName(c.name)
    setCustPhone(c.phone ?? '')
    setShowSuggest(false)
  }

  function setItem(idx: number, patch: Partial<LineItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((arr) => [...arr, blankItem()])
  }
  function removeItem(idx: number) {
    setItems((arr) => (arr.length === 1 ? arr : arr.filter((_, i) => i !== idx)))
  }

  async function save() {
    setError(null)
    const cleanItems = items.filter((it) => it.name.trim() && Number(it.qty) > 0)
    if (!custName.trim()) return setError('Enter a customer name.')
    if (cleanItems.length === 0) return setError('Add at least one item.')

    setSaving(true)
    try {
      // 1. Ensure customer exists / get id
      let customerId = custId
      if (!customerId) {
        const { data: newCust, error: cErr } = await supabase
          .from('customers')
          .insert({ name: custName.trim(), phone: custPhone.trim() || null })
          .select()
          .single()
        if (cErr) throw cErr
        customerId = (newCust as Customer).id
      }

      // 2. Get next invoice number from the DB function
      const { data: numData, error: numErr } = await supabase.rpc('next_invoice_number')
      if (numErr) throw numErr
      const invoiceNumber = numData as string

      const status = balance <= 0 ? 'paid' : Number(advance) > 0 ? 'partial' : 'pending'

      // 3. Insert invoice
      const { data: invData, error: iErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: customerId,
          customer_name: custName.trim(),
          customer_phone: custPhone.trim() || null,
          items: cleanItems,
          subtotal,
          discount: Number(discount || 0),
          advance: Number(advance || 0),
          total,
          balance_due: balance,
          payment_method: paymentMethod,
          delivery_date: deliveryDate || null,
          trial_date: trialDate || null,
          status,
          notes: notes.trim() || null,
        })
        .select()
        .single()
      if (iErr) throw iErr

      // 4. Update customer lifetime value + order count
      const cust = customers.find((c) => c.id === customerId)
      await supabase
        .from('customers')
        .update({
          total_orders: (cust?.total_orders ?? 0) + 1,
          lifetime_value: Number(cust?.lifetime_value ?? 0) + total,
        })
        .eq('id', customerId)

      setSaved(invData as Invoice)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save invoice.')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setSaved(null)
    setCustId(null)
    setCustName('')
    setCustPhone('')
    setDeliveryDate('')
    setTrialDate('')
    setNotes('')
    setItems([blankItem()])
    setDiscount(0)
    setAdvance(0)
    setPaymentMethod('Cash')
  }

  // ── Saved confirmation view ──
  if (saved) {
    return (
      <>
        <PageHeader
          title="Invoice Generated"
          sub={`#${saved.invoice_number}`}
          actions={
            <button className="btn btn-outline no-print" onClick={reset}>
              ＋ New Invoice
            </button>
          }
        />
        <div className="g-sidebar">
          <Card title="Invoice">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div className="font-serif" style={{ fontSize: '1.2rem' }}>{shop.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{shop.location} · {shop.phone}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>#{saved.invoice_number}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{today()}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.82rem', marginBottom: 12 }}>
              <strong>Bill To:</strong> {saved.customer_name} {saved.customer_phone ? `· ${saved.customer_phone}` : ''}
            </div>
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {saved.items.map((it, i) => (
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
          </Card>
          <div>
            <Card title="Summary" sticky>
              <div className="sum-row"><span>Subtotal</span><span>{inr(saved.subtotal)}</span></div>
              <div className="sum-row"><span>Discount</span><span style={{ color: 'var(--green)' }}>–{inr(saved.discount)}</span></div>
              <div className="sum-row total"><span>Total</span><span>{inr(saved.total)}</span></div>
              <div className="sum-row paid"><span>Paid via {saved.payment_method}</span><span>{inr(saved.advance)}</span></div>
              {Number(saved.balance_due) > 0 ? (
                <div className="sum-row balance"><span>Balance Due</span><span>{inr(saved.balance_due)}</span></div>
              ) : (
                <div className="sum-row" style={{ color: 'var(--green)', fontWeight: 600 }}><span>Paid in Full</span><span>✓</span></div>
              )}
              <div className="no-print" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a
                  className="btn btn-gold"
                  href={whatsappLink(saved.customer_phone, invoiceMessage(saved, shop))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ width: '100%' }}
                >
                  📲 Send on WhatsApp
                </a>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => window.print()}>
                  🖨 Print
                </button>
              </div>
            </Card>
          </div>
        </div>
      </>
    )
  }

  // ── Editor view ──
  return (
    <>
      <PageHeader
        title="New Sale / Invoice"
        sub="Bill stitching, readymade or fabric to customers"
        actions={
          <button className="btn btn-gold" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Generate Invoice'}
          </button>
        }
      />
      {error && <div className="alert-strip a-red">{error}</div>}
      <div className="g-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Customer">
            <div className="form-row">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Customer Name</label>
                <Input
                  value={custName}
                  placeholder="Search or add…"
                  onChange={(e) => {
                    setCustName(e.target.value)
                    setCustId(null)
                    setShowSuggest(true)
                  }}
                  onFocus={() => setShowSuggest(true)}
                />
                {showSuggest && suggestions.length > 0 && (
                  <div
                    className="glass-card"
                    style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, padding: 6, maxHeight: 220, overflowY: 'auto' }}
                  >
                    {suggestions.slice(0, 6).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => pickCustomer(c)}
                        style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <strong>{c.name}</strong>
                        <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{c.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Field label="Phone">
                <Input value={custPhone} placeholder="+91…" onChange={(e) => setCustPhone(e.target.value)} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Delivery Date">
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </Field>
              <Field label="Trial Date">
                <Input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Order Notes">
              <Input value={notes} placeholder="Loose fit, contrast buttons…" onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </Card>

          <Card title="Scan Barcode">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14" /></svg>
              <input
                ref={scanRef}
                className="scan-input"
                value={scanCode}
                placeholder="Scan barcode or type SKU + Enter…"
                autoFocus
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleScan(scanCode)
                  }
                }}
              />
            </div>
            {scanMsg && (
              <div
                className={`alert-strip ${scanMsg.tone === 'green' ? 'a-green' : 'a-red'}`}
                style={{ marginTop: 10, marginBottom: 0 }}
              >
                {scanMsg.text}
              </div>
            )}
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 8 }}>
              Works with USB barcode scanners (they type the code + Enter automatically) or manual entry.
              {inventory.length > 0 && ` · ${inventory.filter((i) => i.barcode).length} items have barcodes.`}
            </div>
          </Card>

          <Card title="Items">
            <div className="items-adder">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 30px', gap: 8, marginBottom: 8 }}>
                {['Item', 'Qty', 'Rate', 'Amount', ''].map((h) => (
                  <span key={h} style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {items.map((it, i) => (
                <div className="item-row" key={i}>
                  <Input value={it.name} placeholder="Item name" onChange={(e) => setItem(i, { name: e.target.value })} />
                  <Input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                  <Input type="number" min={0} value={it.rate} onChange={(e) => setItem(i, { rate: Number(e.target.value) })} />
                  <Input value={inr(Number(it.qty) * Number(it.rate))} readOnly tabIndex={-1} />
                  <button className="del-btn" onClick={() => removeItem(i)} aria-label="Remove">✕</button>
                </div>
              ))}
              <button className="add-item-btn" onClick={addItem}>＋ Add Item</button>
            </div>
          </Card>

          <Card title="Payment">
            <div className="form-row">
              <Field label="Payment Method">
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option>Cash</option><option>UPI</option><option>Credit</option>
                </Select>
              </Field>
              <Field label="Discount (₹)">
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Amount Paid (₹)">
                <Input type="number" min={0} value={advance} onChange={(e) => setAdvance(Number(e.target.value))} />
              </Field>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Invoice Summary" sticky>
            <div className="sum-row"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="sum-row"><span>Discount</span><span style={{ color: 'var(--green)' }}>–{inr(discount)}</span></div>
            <div className="sum-row total"><span>Total</span><span>{inr(total)}</span></div>
            <div className="sum-row paid"><span>Amount Paid ({paymentMethod})</span><span>{inr(advance)}</span></div>
            {balance > 0 ? (
              <div className="sum-row balance"><span>Balance Due</span><span>{inr(balance)}</span></div>
            ) : (
              <div className="sum-row" style={{ color: 'var(--green)', fontWeight: 600 }}><span>Paid in Full</span><span>✓</span></div>
            )}
            <button className="btn btn-gold" style={{ width: '100%', marginTop: 16 }} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Generate & Save'}
            </button>
            {custId === null && custName && (
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
                New customer “{custName}” will be created
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
