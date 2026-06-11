import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Invoice, Purchase, Expense, SalesReturn, InventoryItem, Customer } from '../lib/types'
import { inr, inrShort, shortDate, longDate, isThisMonth, monthLabel, downloadCsv } from '../lib/format'
import { Card, PageHeader, Pill, Kpi, BarChart, Empty } from '../components/ui'

type Tab = 'overview' | 'sales' | 'purchases' | 'returns' | 'expenses' | 'customers'
type Range = 'month' | 'all' | 'custom'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'sales', label: '🧾 Sales' },
  { id: 'purchases', label: '📦 Purchases' },
  { id: 'returns', label: '↩️ Returns' },
  { id: 'expenses', label: '💸 Expenses' },
  { id: 'customers', label: '👥 Customers' },
]

export default function Reports() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [range, setRange] = useState<Range>('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('purchases').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*'),
      supabase.from('sales_returns').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory').select('*'),
      supabase.from('customers').select('*').order('name'),
    ]).then(([i, p, e, sr, inv, c]) => {
      setInvoices((i.data as Invoice[]) ?? [])
      setPurchases((p.data as Purchase[]) ?? [])
      setExpenses((e.data as Expense[]) ?? [])
      setReturns((sr.data as SalesReturn[]) ?? [])
      setInventory((inv.data as InventoryItem[]) ?? [])
      setCustomers((c.data as Customer[]) ?? [])
      setLoading(false)
    })
  }, [])

  const within = (d: string | null | undefined) => {
    if (!d) return false
    if (range === 'all') return true
    if (range === 'custom') {
      const day = String(d).slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    }
    return isThisMonth(d)
  }
  const rangeLabel = range === 'all' ? 'All time' : range === 'custom' ? `${from || '…'} → ${to || '…'}` : monthLabel()

  // ── Filtered datasets ──
  const fInvoices = useMemo(() => invoices.filter((i) => within(i.created_at)), [invoices, range, from, to])
  const fPurchases = useMemo(() => purchases.filter((p) => within(p.date)), [purchases, range, from, to])
  const fReturns = useMemo(() => returns.filter((r) => within(r.date)), [returns, range, from, to])
  const fExpenses = useMemo(() => expenses.filter((e) => within(e.date)), [expenses, range, from, to])

  const custBalance = (id: string) => invoices.filter((i) => i.customer_id === id).reduce((s, i) => s + Number(i.balance_due), 0)

  // ── Overview numbers ──
  const grossSales = fInvoices.reduce((s, i) => s + Number(i.total), 0)
  const salesReturns = fReturns.reduce((s, r) => s + Number(r.total), 0)
  const netSales = grossSales - salesReturns
  const cogs = fPurchases.reduce((s, p) => s + Number(p.total), 0)
  const grossProfit = netSales - cogs
  const expenseTotal = fExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const netProfit = grossProfit - expenseTotal
  const pending = invoices.reduce((s, i) => s + Number(i.balance_due), 0)

  const catMap: Record<string, number> = {}
  const catOf = (name: string) => inventory.find((i) => i.name.toLowerCase() === name.toLowerCase())?.category ?? 'Other'
  for (const inv of fInvoices) for (const li of inv.items) {
    const c = catOf(li.name)
    catMap[c] = (catMap[c] ?? 0) + Number(li.qty) * Number(li.rate)
  }
  const byCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(1, ...byCat.map(([, v]) => v))
  const catColors = ['var(--ink)', 'var(--gold)', 'var(--green)', 'var(--purple)', 'var(--blue)']

  // ── Exports ──
  const stamp = range === 'all' ? 'all-time' : range === 'custom' ? `${from || 'start'}_${to || 'end'}` : new Date().toISOString().slice(0, 7)
  function exportSales() {
    downloadCsv(`sales-${stamp}`,
      ['Invoice', 'Date', 'Customer', 'Phone', 'Payment', 'Subtotal', 'Discount', 'Paid', 'Balance', 'Total', 'Status'],
      fInvoices.map((i) => [
        i.invoice_number, shortDate(i.created_at), i.customer_name ?? '', i.customer_phone ?? '',
        i.payment_method, Number(i.subtotal), Number(i.discount), Number(i.advance),
        Number(i.balance_due), Number(i.total), i.status,
      ]))
  }
  function exportPurchases() {
    downloadCsv(`purchases-${stamp}`,
      ['Date', 'Supplier', 'Phone', 'Bill No', 'Tax', 'Total', 'Payment', 'Status'],
      fPurchases.map((p) => [
        shortDate(p.date), p.supplier, p.supplier_phone ?? '', p.bill_no ?? '',
        Number(p.tax_amount), Number(p.total), p.payment_mode, p.status,
      ]))
  }
  function exportReturns() {
    downloadCsv(`returns-${stamp}`,
      ['Date', 'Customer', 'Reason', 'Refund Method', 'Items', 'Total'],
      fReturns.map((r) => [
        shortDate(r.date), r.customer_name ?? '', r.reason ?? '', r.refund_method ?? '',
        (r.items ?? []).reduce((s, it) => s + Number(it.qty), 0), Number(r.total),
      ]))
  }
  function exportExpenses() {
    downloadCsv(`expenses-${stamp}`,
      ['Date', 'Category', 'Description', 'Paid Via', 'Amount'],
      fExpenses.map((e) => [
        shortDate(e.date), e.category, e.description ?? '', e.paid_via, Number(e.amount),
      ]))
  }
  function exportCustomers() {
    downloadCsv('customers',
      ['Name', 'Phone', 'Orders', 'Lifetime Value', 'Balance Due', 'WhatsApp Consent', 'Joined'],
      customers.map((c) => [
        c.name, c.phone ?? '', c.total_orders, Number(c.lifetime_value),
        custBalance(c.id), c.consent ? 'Yes' : 'No', longDate(c.created_at),
      ]))
  }

  if (loading) return <Empty>Building reports…</Empty>

  const exportBtn = (fn: () => void) => (
    <button className="btn btn-gold" onClick={fn}>⬇ Export to Excel</button>
  )

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        sub={`Business reports — ${rangeLabel}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${range === 'month' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRange('month')}>This Month</button>
            <button className={`btn btn-sm ${range === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRange('all')}>All Time</button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, border: `1.5px solid ${range === 'custom' ? 'var(--ink)' : 'rgba(0,0,0,0.1)'}` }}>
              <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setRange('custom') }} style={{ border: 'none', background: 'transparent', fontSize: '0.78rem', fontFamily: 'inherit', color: 'var(--ink)' }} />
              <span style={{ color: 'var(--muted)' }}>→</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setRange('custom') }} style={{ border: 'none', background: 'transparent', fontSize: '0.78rem', fontFamily: 'inherit', color: 'var(--ink)' }} />
            </span>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-outline'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="g4 mb16">
            <Kpi value={inrShort(grossSales)} label="Gross Sales" color="var(--green)" />
            <Kpi value={inrShort(cogs)} label="Total Purchase" color="var(--blue)" />
            <Kpi value={inrShort(expenseTotal)} label="Expenses" color="var(--red)" />
            <Kpi value={inrShort(netProfit)} label="Net Profit" color="var(--gold)" />
          </div>
          <div className="g2 mb16">
            <Card title="Revenue by Category">
              {byCat.length === 0 ? <Empty>No sales in this period.</Empty> : (
                <BarChart rows={byCat.map(([cat, val], i) => ({ label: cat, pct: (val / maxCat) * 100, amount: inrShort(val), color: catColors[i % catColors.length], right: `${Math.round((val / (grossSales || 1)) * 100)}%` }))} />
              )}
            </Card>
            <Card title={`P&L Summary — ${rangeLabel}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="sum-row" style={{ color: 'var(--green)', fontWeight: 600 }}><span>Gross Sales</span><span>{inr(grossSales)}</span></div>
                <div className="sum-row"><span>Sales Returns</span><span style={{ color: 'var(--red)' }}>– {inr(salesReturns)}</span></div>
                <div className="sum-row"><span>Net Sales</span><span>{inr(netSales)}</span></div>
                <div className="sum-row"><span>Cost of Goods</span><span>– {inr(cogs)}</span></div>
                <div className="sum-row"><span style={{ fontWeight: 600 }}>Gross Profit</span><span style={{ color: 'var(--green)', fontWeight: 600 }}>{inr(grossProfit)}</span></div>
                <div className="sum-row"><span>Expenses</span><span>– {inr(expenseTotal)}</span></div>
                <div className="sum-row total"><span>Net Profit</span><span style={{ color: netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{inr(netProfit)}</span></div>
              </div>
            </Card>
          </div>
          <Card title="Pending Collections">
            <div className="sum-row total"><span>Total Outstanding (all time)</span><span style={{ color: 'var(--red)' }}>{inr(pending)}</span></div>
          </Card>
        </>
      )}

      {tab === 'sales' && (
        <Card title={`Sales Report — ${fInvoices.length} invoices`} actions={exportBtn(exportSales)}>
          {fInvoices.length === 0 ? <Empty>No sales in this period.</Empty> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Payment</th><th className="r">Paid</th><th className="r">Balance</th><th className="r">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {fInvoices.map((i) => (
                    <tr key={i.id}>
                      <td><strong>#{i.invoice_number}</strong></td>
                      <td>{shortDate(i.created_at)}</td>
                      <td>{i.customer_name ?? '—'}</td>
                      <td>{i.payment_method}</td>
                      <td className="r">{inr(i.advance)}</td>
                      <td className="r" style={{ color: Number(i.balance_due) > 0 ? 'var(--red)' : undefined }}>{Number(i.balance_due) > 0 ? inr(i.balance_due) : '—'}</td>
                      <td className="r">{inr(i.total)}</td>
                      <td>{Number(i.balance_due) <= 0 ? <Pill tone="green">Paid</Pill> : <Pill tone="gold">Due</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'purchases' && (
        <Card title={`Purchase Report — ${fPurchases.length} bills`} actions={exportBtn(exportPurchases)}>
          {fPurchases.length === 0 ? <Empty>No purchases in this period.</Empty> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Date</th><th>Supplier</th><th>Bill No</th><th>Payment</th><th className="r">Tax</th><th className="r">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {fPurchases.map((p) => (
                    <tr key={p.id}>
                      <td>{shortDate(p.date)}</td>
                      <td><strong>{p.supplier}</strong></td>
                      <td>{p.bill_no ?? '—'}</td>
                      <td>{p.payment_mode}</td>
                      <td className="r">{Number(p.tax_amount) > 0 ? inr(p.tax_amount) : '—'}</td>
                      <td className="r">{inr(p.total)}</td>
                      <td><Pill tone={p.status === 'paid' ? 'green' : 'gold'}>{p.status === 'paid' ? 'Paid' : 'Due'}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'returns' && (
        <Card title={`Returns Report — ${fReturns.length} returns`} actions={exportBtn(exportReturns)}>
          {fReturns.length === 0 ? <Empty>No returns in this period.</Empty> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Date</th><th>Customer</th><th>Reason</th><th>Refund</th><th className="r">Total</th></tr></thead>
                <tbody>
                  {fReturns.map((r) => (
                    <tr key={r.id}>
                      <td>{shortDate(r.date)}</td>
                      <td>{r.customer_name ?? '—'}</td>
                      <td>{r.reason ?? '—'}</td>
                      <td><Pill tone="blue">{r.refund_method ?? '—'}</Pill></td>
                      <td className="r">{inr(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'expenses' && (
        <Card title={`Expenses Report — ${inr(expenseTotal)} total`} actions={exportBtn(exportExpenses)}>
          {fExpenses.length === 0 ? <Empty>No expenses in this period.</Empty> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid Via</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {fExpenses.map((e) => (
                    <tr key={e.id}>
                      <td>{shortDate(e.date)}</td>
                      <td><strong>{e.category}</strong></td>
                      <td>{e.description ?? '—'}</td>
                      <td><Pill tone="blue">{e.paid_via}</Pill></td>
                      <td className="r">{inr(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'customers' && (
        <Card title={`Customer Report — ${customers.length} customers`} actions={exportBtn(exportCustomers)}>
          {customers.length === 0 ? <Empty>No customers yet.</Empty> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Name</th><th>Phone</th><th className="r">Orders</th><th className="r">Lifetime</th><th className="r">Balance</th><th>Consent</th></tr></thead>
                <tbody>
                  {customers.map((c) => {
                    const bal = custBalance(c.id)
                    return (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.phone ?? '—'}</td>
                        <td className="r">{c.total_orders}</td>
                        <td className="r">{inr(c.lifetime_value)}</td>
                        <td className="r" style={{ color: bal > 0 ? 'var(--red)' : undefined }}>{bal > 0 ? inr(bal) : '—'}</td>
                        <td>{c.consent ? <Pill tone="green">Yes</Pill> : <Pill tone="gray">No</Pill>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  )
}
