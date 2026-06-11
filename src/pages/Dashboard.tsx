import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Invoice, Purchase, InventoryItem, Expense } from '../lib/types'
import { inr, inrShort, isThisMonth } from '../lib/format'
import { Card, StatCard, Pill, Empty } from '../components/ui'

export default function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('purchases').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory').select('*'),
      supabase.from('expenses').select('*'),
    ]).then(([inv, pur, stock, exp]) => {
      setInvoices((inv.data as Invoice[]) ?? [])
      setPurchases((pur.data as Purchase[]) ?? [])
      setInventory((stock.data as InventoryItem[]) ?? [])
      setExpenses((exp.data as Expense[]) ?? [])
      setLoading(false)
    })
  }, [])

  const salesMonth = invoices.filter((i) => isThisMonth(i.created_at)).reduce((s, i) => s + Number(i.total), 0)
  const purchaseMonth = purchases.filter((p) => isThisMonth(p.created_at)).reduce((s, p) => s + Number(p.total), 0)
  const expenseMonth = expenses.filter((e) => isThisMonth(e.date)).reduce((s, e) => s + Number(e.amount), 0)
  const itemsInStock = inventory.reduce((s, i) => s + Number(i.in_stock), 0)
  const pending = invoices.reduce((s, i) => s + Number(i.balance_due), 0)
  const overdue = invoices.filter((i) => Number(i.balance_due) > 0).length
  const lowStock = inventory.filter((i) => Number(i.in_stock) <= Number(i.min_level) && i.category !== 'Stitching')

  // Sales by month for the mini bar chart (last 6 months)
  const months: { label: string; value: number }[] = []
  for (let k = 5; k >= 0; k--) {
    const d = new Date()
    d.setMonth(d.getMonth() - k)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const value = invoices
      .filter((i) => (i.created_at ?? '').startsWith(key))
      .reduce((s, i) => s + Number(i.total), 0)
    months.push({ label: d.toLocaleDateString('en-IN', { month: 'short' }), value })
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.value))

  const today = new Date().toISOString().slice(0, 10)
  const recent = invoices.slice(0, 5)

  // Daily cash summary — today's collections grouped by payment method.
  const todaysInvoices = invoices.filter((i) => (i.created_at ?? '').slice(0, 10) === today)
  const cashByMethod: Record<string, number> = { Cash: 0, UPI: 0, Credit: 0 }
  for (const i of todaysInvoices) {
    const m = i.payment_method || 'Cash'
    cashByMethod[m] = (cashByMethod[m] ?? 0) + Number(i.advance)
  }
  const collectedToday = cashByMethod.Cash + cashByMethod.UPI + cashByMethod.Credit
  const methodTiles: { key: string; label: string; icon: string; color: string }[] = [
    { key: 'Cash', label: 'Cash', icon: '💵', color: 'var(--green)' },
    { key: 'UPI', label: 'UPI', icon: '📱', color: 'var(--blue)' },
    { key: 'Credit', label: 'Credit', icon: '🧾', color: 'var(--gold)' },
  ]

  if (loading) return <Empty>Loading dashboard…</Empty>

  return (
    <>
      <div className="g4 mb20">
        <StatCard
          accent="green"
          value={inrShort(salesMonth)}
          label="Sales This Month"
          change={`${invoices.filter((i) => isThisMonth(i.created_at)).length} invoices`}
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
        />
        <StatCard
          accent="blue"
          value={inrShort(purchaseMonth)}
          label="Purchases This Month"
          change={`${purchases.filter((p) => isThisMonth(p.created_at)).length} entries`}
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></svg>}
        />
        <StatCard
          accent="gold"
          value={itemsInStock.toLocaleString('en-IN')}
          label="Items in Stock"
          change={lowStock.length ? `${lowStock.length} low` : 'Healthy'}
          changeDir={lowStock.length ? 'down' : 'up'}
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>}
        />
        <StatCard
          accent="red"
          value={inr(pending)}
          label="Pending Collections"
          change={overdue ? `${overdue} unpaid` : 'All clear'}
          changeDir={overdue ? 'down' : 'up'}
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
        />
      </div>

      <div className="g2 mb16">
        <Card title="Sales — Last 6 Months">
          {salesMonth === 0 && months.every((m) => m.value === 0) ? (
            <Empty>No sales recorded yet. Create your first invoice!</Empty>
          ) : (
            <div className="mini-bars">
              {months.map((m, i) => (
                <div className="mini-bar-wrap" key={i}>
                  <div className="mini-bar-val">{inrShort(m.value)}</div>
                  <div
                    className="mini-bar"
                    style={{
                      height: `${(m.value / maxMonth) * 100}%`,
                      ...(i === months.length - 1
                        ? { background: 'linear-gradient(180deg,var(--ink),var(--ink-2))' }
                        : {}),
                    }}
                  />
                  <div className="mini-bar-label">{m.label}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Profit Snapshot — This Month">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="sum-row"><span>Gross Sales</span><span>{inr(salesMonth)}</span></div>
            <div className="sum-row"><span>Purchase Cost</span><span>{inr(purchaseMonth)}</span></div>
            <div className="sum-row"><span>Expenses</span><span>{inr(expenseMonth)}</span></div>
            <div className="sum-row total">
              <span>Net (Sales − Costs)</span>
              <span style={{ color: salesMonth - purchaseMonth - expenseMonth >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {inr(salesMonth - purchaseMonth - expenseMonth)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="g2 mb16">
        <Card title="Recent Transactions">
          {recent.length === 0 ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Invoice</th><th>Customer</th><th className="r">Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {recent.map((i) => (
                    <tr key={i.id}>
                      <td><strong>{i.invoice_number}</strong></td>
                      <td>{i.customer_name ?? '—'}</td>
                      <td className="r">{inr(i.total)}</td>
                      <td>
                        {Number(i.balance_due) <= 0 ? (
                          <Pill tone="green">Paid</Pill>
                        ) : Number(i.advance) > 0 ? (
                          <Pill tone="gold">Partial</Pill>
                        ) : (
                          <Pill tone="red">Unpaid</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Low Stock Alerts">
          {lowStock.length === 0 ? (
            <Empty>All stock levels are healthy ✅</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowStock.slice(0, 5).map((it) => {
                const critical = Number(it.in_stock) <= Number(it.min_level) / 2
                return (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: 10,
                      background: critical ? 'var(--red-l)' : 'var(--gold-l)',
                      borderLeft: `3px solid ${critical ? 'var(--red)' : 'var(--gold)'}`,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{it.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                        {Number(it.in_stock)} left · min {Number(it.min_level)}
                      </div>
                    </div>
                    <Pill tone={critical ? 'red' : 'gold'}>{critical ? 'Critical' : 'Low'}</Pill>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Card title={`Today's Cash Summary — ${todaysInvoices.length} bill${todaysInvoices.length === 1 ? '' : 's'}`}>
        <div className="g3 mb16">
          {methodTiles.map((t) => (
            <div key={t.key} className="kpi-tile" style={{ borderTop: `3px solid ${t.color}` }}>
              <div style={{ fontSize: '1.3rem' }}>{t.icon}</div>
              <div className="kpi-val" style={{ color: t.color }}>{inr(cashByMethod[t.key])}</div>
              <div className="kpi-key">{t.label}</div>
            </div>
          ))}
        </div>
        <div className="sum-row total">
          <span>Total Collected Today</span>
          <span style={{ color: 'var(--green)' }}>{inr(collectedToday)}</span>
        </div>
        {todaysInvoices.length === 0 && <Empty>No sales yet today.</Empty>}
      </Card>
    </>
  )
}
