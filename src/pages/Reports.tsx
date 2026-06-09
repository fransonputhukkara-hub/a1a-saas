import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Invoice, Purchase, Expense, Payroll, SalesReturn, InventoryItem } from '../lib/types'
import { inr, inrShort, shortDate, isThisMonth, monthKey, monthLabel } from '../lib/format'
import { Card, PageHeader, Pill, Kpi, BarChart, Empty } from '../components/ui'

export default function Reports() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [payroll, setPayroll] = useState<Payroll[]>([])
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('purchases').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('payroll').select('*').eq('month', monthKey()),
      supabase.from('sales_returns').select('*'),
      supabase.from('inventory').select('*'),
    ]).then(([i, p, e, pr, sr, inv]) => {
      setInvoices((i.data as Invoice[]) ?? [])
      setPurchases((p.data as Purchase[]) ?? [])
      setExpenses((e.data as Expense[]) ?? [])
      setPayroll((pr.data as Payroll[]) ?? [])
      setReturns((sr.data as SalesReturn[]) ?? [])
      setInventory((inv.data as InventoryItem[]) ?? [])
      setLoading(false)
    })
  }, [])

  const grossSales = invoices.filter((i) => isThisMonth(i.created_at)).reduce((s, i) => s + Number(i.total), 0)
  const salesReturns = returns.filter((r) => isThisMonth(r.date)).reduce((s, r) => s + Number(r.total), 0)
  const netSales = grossSales - salesReturns
  const cogs = purchases.filter((p) => isThisMonth(p.created_at)).reduce((s, p) => s + Number(p.total), 0)
  const grossProfit = netSales - cogs
  const expenseTotal = expenses.filter((e) => isThisMonth(e.date)).reduce((s, e) => s + Number(e.amount), 0)
  const payrollTotal = payroll.reduce((s, p) => s + Number(p.net_pay), 0)
  const netProfit = grossProfit - expenseTotal - payrollTotal
  const pending = invoices.reduce((s, i) => s + Number(i.balance_due), 0)

  // Revenue by inventory category
  const catMap: Record<string, number> = {}
  const catOf = (name: string) => inventory.find((i) => i.name.toLowerCase() === name.toLowerCase())?.category ?? 'Other'
  for (const inv of invoices.filter((i) => isThisMonth(i.created_at))) for (const li of inv.items) {
    const c = catOf(li.name)
    catMap[c] = (catMap[c] ?? 0) + Number(li.qty) * Number(li.rate)
  }
  const byCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(1, ...byCat.map(([, v]) => v))
  const catColors = ['var(--ink)', 'var(--gold)', 'var(--green)', 'var(--purple)', 'var(--blue)']

  if (loading) return <Empty>Building reports…</Empty>

  return (
    <>
      <PageHeader title="Reports & Analytics" sub={`Full business overview — ${monthLabel()}`} actions={<button className="btn btn-outline" onClick={() => window.print()}>⬇ Export PDF</button>} />

      <div className="g4 mb16">
        <Kpi value={inrShort(grossSales)} label="Gross Sales" color="var(--green)" />
        <Kpi value={inrShort(cogs)} label="Total Purchase" color="var(--blue)" />
        <Kpi value={inrShort(expenseTotal + payrollTotal)} label="Expenses + Payroll" color="var(--red)" />
        <Kpi value={inrShort(netProfit)} label="Net Profit" color="var(--gold)" />
      </div>

      <div className="g2 mb16">
        <Card title="Revenue by Category">
          {byCat.length === 0 ? <Empty>No sales this month.</Empty> : (
            <BarChart rows={byCat.map(([cat, val], i) => ({ label: cat, pct: (val / maxCat) * 100, amount: inrShort(val), color: catColors[i % catColors.length], right: `${Math.round((val / (grossSales || 1)) * 100)}%` }))} />
          )}
        </Card>
        <Card title={`P&L Summary — ${monthLabel()}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="sum-row" style={{ color: 'var(--green)', fontWeight: 600 }}><span>Gross Sales</span><span>{inr(grossSales)}</span></div>
            <div className="sum-row"><span>Sales Returns</span><span style={{ color: 'var(--red)' }}>– {inr(salesReturns)}</span></div>
            <div className="sum-row"><span>Net Sales</span><span>{inr(netSales)}</span></div>
            <div className="sum-row"><span>Cost of Goods</span><span>– {inr(cogs)}</span></div>
            <div className="sum-row"><span style={{ fontWeight: 600 }}>Gross Profit</span><span style={{ color: 'var(--green)', fontWeight: 600 }}>{inr(grossProfit)}</span></div>
            <div className="sum-row"><span>Expenses</span><span>– {inr(expenseTotal)}</span></div>
            <div className="sum-row"><span>Payroll</span><span>– {inr(payrollTotal)}</span></div>
            <div className="sum-row total"><span>Net Profit</span><span style={{ color: netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{inr(netProfit)}</span></div>
          </div>
        </Card>
      </div>

      <Card title="Invoice Summary" className="mb16">
        {invoices.length === 0 ? <Empty>No invoices yet.</Empty> : (
          <div className="table-wrap">
            <table className="dt">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th className="r">Total</th><th className="r">Paid</th><th className="r">Balance</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.slice(0, 15).map((i) => {
                  const paid = Number(i.total) - Number(i.balance_due)
                  return (
                    <tr key={i.id}>
                      <td><strong>#{i.invoice_number}</strong></td>
                      <td>{i.customer_name ?? '—'}</td>
                      <td>{shortDate(i.created_at)}</td>
                      <td className="r">{inr(i.total)}</td>
                      <td className="r">{inr(paid)}</td>
                      <td className="r" style={{ color: Number(i.balance_due) > 0 ? 'var(--red)' : undefined }}>{Number(i.balance_due) > 0 ? inr(i.balance_due) : '—'}</td>
                      <td>{Number(i.balance_due) <= 0 ? <Pill tone="green">Paid</Pill> : Number(i.advance) > 0 ? <Pill tone="gold">Partial</Pill> : <Pill tone="red">Unpaid</Pill>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Pending Collections">
        <div className="sum-row total"><span>Total Outstanding</span><span style={{ color: 'var(--red)' }}>{inr(pending)}</span></div>
      </Card>
    </>
  )
}
