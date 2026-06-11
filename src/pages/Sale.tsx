import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Customer, Invoice, InventoryItem, LineItem } from '../lib/types'
import { inr, today, whatsappLink, invoiceMessage } from '../lib/format'
import { adjustStock } from '../lib/inventory'
import { useShop } from '../lib/ShopContext'
import { Card, PageHeader, Field, Input } from '../components/ui'
import SuccessModal from '../components/SuccessModal'

const blankItem = (): LineItem => ({ name: '', qty: 1, rate: 0 })

export default function Sale() {
  const { shop } = useShop()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [scanCode, setScanCode] = useState('')
  const [scanMsg, setScanMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('+91 ')
  const [custId, setCustId] = useState<string | null>(null)
  const [custConsent, setCustConsent] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)

  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<LineItem[]>([blankItem()])
  const [discount, setDiscount] = useState(0)
  const [advance, setAdvance] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Invoice | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
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
  // Amount paid can never exceed the bill total (prevents typos like 15500 for 1550).
  const amountPaid = Math.min(Number(advance || 0), total)
  const balance = Math.max(0, total - amountPaid)

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
    setCustConsent(c.consent ?? false)
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

    // Stock guard — don't bill more than what's in stock for known products.
    for (const it of cleanItems) {
      const match = inventory.find((p) => p.name.toLowerCase() === it.name.trim().toLowerCase())
      if (match && Number(it.qty) > Number(match.in_stock)) {
        return setError(`Only ${match.in_stock} of "${match.name}" in stock — can't bill ${it.qty}.`)
      }
    }

    const phone = custPhone.trim() === '+91' ? '' : custPhone.trim()
    setSaving(true)
    try {
      // 1. Ensure customer exists / get id
      let customerId = custId
      if (!customerId) {
        const { data: newCust, error: cErr } = await supabase
          .from('customers')
          .insert({ name: custName.trim(), phone: phone || null, consent: custConsent })
          .select()
          .single()
        if (cErr) throw cErr
        customerId = (newCust as Customer).id
      } else {
        // Keep consent in sync for an existing customer.
        await supabase.from('customers').update({ consent: custConsent }).eq('id', customerId)
      }

      // 2. Get next invoice number from the DB function
      const { data: numData, error: numErr } = await supabase.rpc('next_invoice_number')
      if (numErr) throw numErr
      const invoiceNumber = numData as string

      const status = balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending'

      // 3. Insert invoice
      const { data: invData, error: iErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: customerId,
          customer_name: custName.trim(),
          customer_phone: phone || null,
          items: cleanItems,
          subtotal,
          discount: Number(discount || 0),
          advance: amountPaid,
          total,
          balance_due: balance,
          payment_method: paymentMethod,
          status,
          notes: notes.trim() || null,
        })
        .select()
        .single()
      if (iErr) throw iErr

      // 4. Reduce inventory stock for sold items (keeps store & website in sync)
      await adjustStock(cleanItems, -1)

      // 5. Update customer lifetime value + order count
      const cust = customers.find((c) => c.id === customerId)
      await supabase
        .from('customers')
        .update({
          total_orders: (cust?.total_orders ?? 0) + 1,
          lifetime_value: Number(cust?.lifetime_value ?? 0) + total,
        })
        .eq('id', customerId)

      setSaved(invData as Invoice)
      setShowSuccess(true)
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
    setCustPhone('+91 ')
    setCustConsent(false)
    setNotes('')
    setItems([blankItem()])
    setDiscount(0)
    setAdvance(0)
    setPaymentMethod('Cash')
  }

  // ── Saved confirmation view ──
  if (saved) {
    const waLink = whatsappLink(saved.customer_phone, invoiceMessage(saved, shop))
    return (
      <>
        {showSuccess && (
          <SuccessModal
            title="Invoice Generated Successfully!"
            subtitle="Your invoice has been created and saved."
            details={[
              { label: 'Invoice Number', value: `#${saved.invoice_number}` },
              { label: 'Customer Name', value: saved.customer_name ?? '—' },
              { label: 'Total Amount', value: inr(saved.total) },
              { label: 'Date & Time', value: new Date(saved.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
            ]}
            onClose={() => setShowSuccess(false)}
            actions={
              <>
                <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print</button>
                <button className="btn btn-outline" onClick={() => window.print()}>⬇ PDF</button>
                {custConsent
                  ? <a className="btn btn-gold" href={waLink} target="_blank" rel="noopener noreferrer">📲 WhatsApp</a>
                  : <button className="btn btn-outline" disabled title="No DPDP consent">📲 WhatsApp</button>}
                <button className="btn btn-outline" onClick={() => setShowSuccess(false)}>👁 View Invoice</button>
              </>
            }
          />
        )}
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
                {custConsent ? (
                  <a
                    className="btn btn-gold"
                    href={whatsappLink(saved.customer_phone, invoiceMessage(saved, shop))}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ width: '100%' }}
                  >
                    📲 Send on WhatsApp
                  </a>
                ) : (
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>
                    WhatsApp disabled — customer hasn't given DPDP consent
                  </div>
                )}
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
              <Field label="Invoice Date">
                <Input value={today()} readOnly tabIndex={-1} />
              </Field>
              <Field label="Order Notes">
                <Input value={notes} placeholder="Loose fit, contrast buttons…" onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.78rem', marginTop: 6, cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" style={{ marginTop: 3 }} checked={custConsent} onChange={(e) => setCustConsent(e.target.checked)} />
              <span>Customer agrees to receive invoices &amp; offers via WhatsApp <span style={{ color: 'var(--muted)' }}>(DPDP Act 2023)</span></span>
            </label>
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
                  <Input type="number" min={0} placeholder="1" value={it.qty || ''} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                  <Input type="number" min={0} placeholder="0" value={it.rate || ''} onChange={(e) => setItem(i, { rate: Number(e.target.value) })} />
                  <Input value={inr(Number(it.qty) * Number(it.rate))} readOnly tabIndex={-1} />
                  <button className="del-btn" onClick={() => removeItem(i)} aria-label="Remove">✕</button>
                </div>
              ))}
              <button className="add-item-btn" onClick={addItem}>＋ Add Item</button>
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Payment">
            <label className="form-label">Payment Method</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {(['Cash', 'UPI', 'Credit'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  style={{
                    flex: 1, minWidth: 90, padding: '14px 10px', borderRadius: 12, cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.9rem',
                    border: `2px solid ${paymentMethod === m ? 'var(--ink)' : 'rgba(0,0,0,0.1)'}`,
                    background: paymentMethod === m ? 'var(--ink)' : 'rgba(255,255,255,0.6)',
                    color: paymentMethod === m ? '#fff' : 'var(--ink)',
                  }}
                >
                  {m === 'Cash' ? '💵 ' : m === 'UPI' ? '📱 ' : '🧾 '}{m}
                </button>
              ))}
            </div>
            <div className="form-row">
              <Field label="Discount (₹)">
                <Input type="number" min={0} placeholder="0" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))} />
              </Field>
              <Field label="Amount Paid (₹)">
                <Input type="number" min={0} max={total} placeholder="0" value={advance || ''} onChange={(e) => setAdvance(Math.min(Number(e.target.value), total))} />
              </Field>
            </div>
          </Card>

          <Card title="Invoice Summary" sticky>
            <div className="sum-row"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="sum-row"><span>Discount</span><span style={{ color: 'var(--green)' }}>–{inr(discount)}</span></div>
            <div className="sum-row total"><span>Total</span><span>{inr(total)}</span></div>
            <div className="sum-row paid"><span>Amount Paid ({paymentMethod})</span><span>{inr(amountPaid)}</span></div>
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
