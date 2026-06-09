import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InventoryItem, Invoice, Purchase, SalesReturn } from '../lib/types'
import { inrShort, isThisMonth } from '../lib/format'
import { Card, PageHeader, Pill, Kpi, BarChart, Empty } from '../components/ui'

interface Flow {
  name: string
  purchased: number
  sold: number
  returned: number
  closing: number
  opening: number
  revenue: number
  margin: number
}

export default function ProductFlow() {
  const [flows, setFlows] = useState<Flow[]>([])
  const [totals, setTotals] = useState({ purchased: 0, sold: 0, returned: 0, margin: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('inventory').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('purchases').select('*'),
      supabase.from('sales_returns').select('*'),
    ]).then(([inv, invo, pur, sr]) => {
      const inventory = (inv.data as InventoryItem[]) ?? []
      const invoices = (invo.data as Invoice[]) ?? []
      const purchases = (pur.data as Purchase[]) ?? []
      const returns = (sr.data as SalesReturn[]) ?? []

      const map = new Map<string, Flow>()
      const get = (name: string): Flow => {
        const key = name.toLowerCase()
        if (!map.has(key)) map.set(key, { name, purchased: 0, sold: 0, returned: 0, closing: 0, opening: 0, revenue: 0, margin: 0 })
        return map.get(key)!
      }

      for (const it of inventory) get(it.name).closing = Number(it.in_stock)
      for (const p of purchases.filter((x) => isThisMonth(x.created_at))) for (const li of p.items) get(li.name).purchased += Number(li.qty)
      for (const inv of invoices.filter((x) => isThisMonth(x.created_at))) for (const li of inv.items) {
        const f = get(li.name); f.sold += Number(li.qty); f.revenue += Number(li.qty) * Number(li.rate)
      }
      for (const r of returns.filter((x) => isThisMonth(x.date))) for (const li of r.items) get(li.name).returned += Number(li.qty)

      const list = [...map.values()].map((f) => {
        f.opening = Math.max(0, f.closing - f.purchased + f.sold - f.returned)
        const cost = inventory.find((i) => i.name.toLowerCase() === f.name.toLowerCase())
        const buy = Number(cost?.buying_rate ?? 0)
        const avgSell = f.sold > 0 ? f.revenue / f.sold : Number(cost?.selling_rate ?? 0)
        f.margin = avgSell > 0 ? Math.round(((avgSell - buy) / avgSell) * 100) : 0
        return f
      })
      list.sort((a, b) => b.revenue - a.revenue)
      setFlows(list)
      setTotals({
        purchased: purchases.filter((x) => isThisMonth(x.created_at)).reduce((s, p) => s + Number(p.total), 0),
        sold: invoices.filter((x) => isThisMonth(x.created_at)).reduce((s, i) => s + Number(i.total), 0),
        returned: returns.filter((x) => isThisMonth(x.date)).reduce((s, r) => s + Number(r.total), 0),
        margin: Math.round(list.reduce((s, f) => s + f.margin, 0) / (list.length || 1)),
      })
      setLoading(false)
    })
  }, [])

  const topSellers = flows.filter((f) => f.sold > 0).slice(0, 5)
  const maxRevenue = Math.max(1, ...topSellers.map((f) => f.revenue))
  const slowMovers = [...flows].filter((f) => f.closing > 0).sort((a, b) => a.sold - b.sold).slice(0, 3)
  const palette = ['var(--ink)', 'var(--gold)', 'var(--blue)', 'var(--green)', 'var(--purple)']

  function trend(f: Flow) {
    if (f.closing <= 0) return <Pill tone="red">Out of Stock</Pill>
    if (f.sold >= 10) return <Pill tone="green">🔥 Hot</Pill>
    if (f.sold >= 4) return <Pill tone="blue">↑ Rising</Pill>
    if (f.sold === 0) return <Pill tone="red">🐌 Slow</Pill>
    return <Pill tone="gold">Steady</Pill>
  }

  if (loading) return <Empty>Analysing product flow…</Empty>

  return (
    <>
      <PageHeader title="Product Flow Analysis" sub="Track how stock moves — purchased, sold, returned" actions={<button className="btn btn-outline" onClick={() => window.print()}>⬇ Export</button>} />

      <div className="g4 mb16">
        <Kpi value={inrShort(totals.purchased)} label="Purchased (Month)" color="var(--blue)" />
        <Kpi value={inrShort(totals.sold)} label="Sold (Month)" color="var(--green)" />
        <Kpi value={inrShort(totals.returned)} label="Returns (Month)" color="var(--red)" />
        <Kpi value={`${totals.margin}%`} label="Avg Margin" color="var(--gold)" />
      </div>

      <div className="g2 mb16">
        <Card title="Top Selling Products — This Month">
          {topSellers.length === 0 ? <Empty>No sales recorded this month.</Empty> : (
            <BarChart rows={topSellers.map((f, i) => ({ label: f.name.slice(0, 14), pct: (f.revenue / maxRevenue) * 100, amount: inrShort(f.revenue), color: palette[i % palette.length], right: `${f.sold} sold` }))} />
          )}
        </Card>
        <Card title="Slowest Moving">
          {slowMovers.length === 0 ? <Empty>Not enough data yet.</Empty> : (
            <BarChart rows={slowMovers.map((f) => ({ label: f.name.slice(0, 14), pct: f.sold === 0 ? 10 : 20, amount: f.sold === 0 ? 'Idle' : 'Slow', color: f.sold === 0 ? 'var(--red)' : 'var(--orange)', right: `${f.sold} sold` }))} />
          )}
        </Card>
      </div>

      <Card title="Full Product Movement Ledger">
        {flows.length === 0 ? <Empty>No product activity yet.</Empty> : (
          <div className="table-wrap">
            <table className="dt">
              <thead><tr><th>Product</th><th className="r">Opening</th><th className="r">Purchased</th><th className="r">Sold</th><th className="r">Returned</th><th className="r">Closing</th><th className="r">Margin</th><th>Trend</th></tr></thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={f.name}>
                    <td><strong>{f.name}</strong></td>
                    <td className="r">{f.opening}</td>
                    <td className="r">{f.purchased}</td>
                    <td className="r">{f.sold}</td>
                    <td className="r">{f.returned}</td>
                    <td className="r" style={{ color: f.closing <= 0 ? 'var(--red)' : undefined, fontWeight: 600 }}>{f.closing}</td>
                    <td className="r" style={{ color: 'var(--green)' }}>{f.margin}%</td>
                    <td>{trend(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
