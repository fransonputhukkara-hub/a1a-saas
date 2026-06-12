import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InventoryItem, Invoice, Purchase, SalesReturn } from '../lib/types'
import { isThisMonth, inr, inrShort } from '../lib/format'
import { Card, PageHeader, Pill, Kpi, BarChart, Empty } from '../components/ui'

interface Flow {
  name: string
  category: string
  inStock: number
  min: number
  buy: number
  sell: number
  sold: number
  purchased: number
  returned: number
}

export default function ProductFlow() {
  const [flows, setFlows] = useState<Flow[]>([])
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
        if (!map.has(key)) map.set(key, { name, category: 'Other', inStock: 0, min: 0, buy: 0, sell: 0, sold: 0, purchased: 0, returned: 0 })
        return map.get(key)!
      }

      for (const it of inventory) {
        const f = get(it.name)
        f.category = it.category ?? 'Other'
        f.inStock = Number(it.in_stock)
        f.min = Number(it.min_level)
        f.buy = Number(it.buying_rate)
        f.sell = Number(it.selling_rate)
      }
      for (const p of purchases.filter((x) => isThisMonth(x.created_at))) for (const li of p.items) get(li.name).purchased += Number(li.qty)
      for (const inv of invoices.filter((x) => isThisMonth(x.created_at))) for (const li of inv.items) get(li.name).sold += Number(li.qty)
      for (const r of returns.filter((x) => isThisMonth(x.date))) for (const li of r.items) get(li.name).returned += Number(li.qty)

      setFlows([...map.values()].sort((a, b) => b.sold - a.sold || b.inStock - a.inStock))
      setLoading(false)
    })
  }, [])

  if (loading) return <Empty>Loading…</Empty>

  const totalPieces = flows.reduce((s, f) => s + f.inStock, 0)
  const stockValue = flows.reduce((s, f) => s + f.inStock * f.buy, 0)
  const retailValue = flows.reduce((s, f) => s + f.inStock * f.sell, 0)
  const soldMonth = flows.reduce((s, f) => s + f.sold, 0)
  const fast = flows.filter((f) => f.sold > 0).slice(0, 6)
  const slow = flows.filter((f) => f.inStock > 0 && f.sold === 0).slice(0, 6)
  const low = flows.filter((f) => f.inStock <= f.min)

  // Stock value by category (always useful, even with no sales)
  const catMap: Record<string, number> = {}
  for (const f of flows) catMap[f.category] = (catMap[f.category] ?? 0) + f.inStock * f.buy
  const byCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(1, ...byCat.map(([, v]) => v))
  const colors = ['var(--ink)', 'var(--gold)', 'var(--green)', 'var(--blue)', 'var(--purple)']

  function status(f: Flow) {
    if (f.inStock <= 0) return <Pill tone="red">Out of stock</Pill>
    if (f.inStock <= f.min) return <Pill tone="gold">Low — buy more</Pill>
    if (f.sold >= 10) return <Pill tone="green">🔥 Selling fast</Pill>
    if (f.sold >= 1) return <Pill tone="blue">Selling</Pill>
    return <Pill tone="gray">In stock</Pill>
  }

  return (
    <>
      <PageHeader title="Stock & Movement" sub="What you're holding, and what's selling" actions={<button className="btn btn-outline" onClick={() => window.print()}>🖨 Print</button>} />

      <div className="g4 mb16">
        <Kpi value={inrShort(stockValue)} label="Stock Value (at cost)" color="var(--blue)" />
        <Kpi value={totalPieces.toLocaleString('en-IN')} label="Pieces in Stock" color="var(--ink)" />
        <Kpi value={String(soldMonth)} label="Sold This Month" color="var(--green)" />
        <Kpi value={String(low.length)} label="Need to Reorder" color="var(--gold)" />
      </div>

      <div className="g2 mb16">
        <Card title="Stock Value by Category">
          {byCat.length === 0 ? <Empty>No products yet.</Empty> : (
            <BarChart rows={byCat.map(([cat, val], i) => ({ label: cat, pct: (val / maxCat) * 100, amount: inrShort(val), color: colors[i % colors.length], right: `${Math.round((val / (stockValue || 1)) * 100)}%` }))} />
          )}
        </Card>
        <Card title="Inventory at a Glance">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="sum-row"><span>Total Products</span><span>{flows.length}</span></div>
            <div className="sum-row"><span>Pieces in Stock</span><span>{totalPieces.toLocaleString('en-IN')}</span></div>
            <div className="sum-row"><span>Stock Value (cost)</span><span>{inr(stockValue)}</span></div>
            <div className="sum-row"><span>Retail Value</span><span style={{ color: 'var(--green)' }}>{inr(retailValue)}</span></div>
            <div className="sum-row total"><span>Potential Profit</span><span style={{ color: 'var(--green)' }}>{inr(retailValue - stockValue)}</span></div>
          </div>
        </Card>
      </div>

      {(fast.length > 0 || slow.length > 0) && (
        <div className="g2 mb16">
          <Card title="🔥 Selling Fast — keep stocked">
            {fast.length === 0 ? <Empty>No sales yet this month.</Empty> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fast.map((f) => (
                  <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--green-l)', borderLeft: '3px solid var(--green)' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.name}</span>
                    <span style={{ fontSize: '0.8rem' }}><strong>{f.sold}</strong> sold · {f.inStock} left</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="🐌 Not Selling — consider a discount">
            {slow.length === 0 ? <Empty>Everything is moving 👍</Empty> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slow.map((f) => (
                  <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.03)' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{f.inStock} in stock</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {low.length > 0 && (
        <Card title="⚠️ Running Low — Reorder Soon" className="mb16">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {low.map((f) => (
              <span key={f.name} style={{ padding: '6px 12px', borderRadius: 20, background: f.inStock <= 0 ? 'var(--red-l)' : 'var(--gold-l)', fontSize: '0.8rem', fontWeight: 600 }}>
                {f.name} — {f.inStock <= 0 ? 'OUT' : `${f.inStock} left`}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card title="All Products">
        {flows.length === 0 ? <Empty>No products yet. Add stock in Inventory or via a Purchase.</Empty> : (
          <div className="table-wrap">
            <table className="dt">
              <thead><tr><th>Product</th><th>Category</th><th className="r">In Stock</th><th className="r">Sold (Month)</th><th className="r">Stock Value</th><th>Status</th></tr></thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={f.name}>
                    <td><strong>{f.name}</strong></td>
                    <td>{f.category}</td>
                    <td className="r" style={{ color: f.inStock <= 0 ? 'var(--red)' : undefined, fontWeight: 600 }}>{f.inStock}</td>
                    <td className="r">{f.sold}</td>
                    <td className="r">{inr(f.inStock * f.buy)}</td>
                    <td>{status(f)}</td>
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
