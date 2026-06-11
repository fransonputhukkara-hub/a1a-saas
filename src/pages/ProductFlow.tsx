import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InventoryItem, Invoice, Purchase, SalesReturn } from '../lib/types'
import { isThisMonth } from '../lib/format'
import { Card, PageHeader, Pill, Kpi, Empty } from '../components/ui'

interface Flow {
  name: string
  inStock: number
  min: number
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
        if (!map.has(key)) map.set(key, { name, inStock: 0, min: 0, sold: 0, purchased: 0, returned: 0 })
        return map.get(key)!
      }

      for (const it of inventory) {
        const f = get(it.name)
        f.inStock = Number(it.in_stock)
        f.min = Number(it.min_level)
      }
      for (const p of purchases.filter((x) => isThisMonth(x.created_at))) for (const li of p.items) get(li.name).purchased += Number(li.qty)
      for (const inv of invoices.filter((x) => isThisMonth(x.created_at))) for (const li of inv.items) get(li.name).sold += Number(li.qty)
      for (const r of returns.filter((x) => isThisMonth(x.date))) for (const li of r.items) get(li.name).returned += Number(li.qty)

      setFlows([...map.values()].sort((a, b) => b.sold - a.sold))
      setLoading(false)
    })
  }, [])

  if (loading) return <Empty>Loading…</Empty>

  const fast = flows.filter((f) => f.sold > 0).slice(0, 6)
  const slow = flows.filter((f) => f.inStock > 0 && f.sold === 0).slice(0, 6)
  const low = flows.filter((f) => f.inStock <= f.min)

  // Plain-language status for each product
  function status(f: Flow) {
    if (f.inStock <= 0) return <Pill tone="red">Out of stock</Pill>
    if (f.inStock <= f.min) return <Pill tone="gold">Low — buy more</Pill>
    if (f.sold >= 10) return <Pill tone="green">🔥 Selling fast</Pill>
    if (f.sold >= 1) return <Pill tone="blue">Selling</Pill>
    return <Pill tone="gray">🐌 Not selling</Pill>
  }

  return (
    <>
      <PageHeader title="Stock Movement" sub="See what's selling and what's not — at a glance" actions={<button className="btn btn-outline" onClick={() => window.print()}>🖨 Print</button>} />

      <div className="g4 mb16">
        <Kpi value={String(flows.reduce((s, f) => s + f.sold, 0))} label="Pieces Sold (Month)" color="var(--green)" />
        <Kpi value={String(flows.reduce((s, f) => s + f.purchased, 0))} label="Pieces Bought (Month)" color="var(--blue)" />
        <Kpi value={String(low.length)} label="Need to Reorder" color="var(--gold)" />
        <Kpi value={String(flows.filter((f) => f.inStock <= 0).length)} label="Out of Stock" color="var(--red)" />
      </div>

      <div className="g2 mb16">
        <Card title="🔥 Selling Fast — keep these stocked">
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
        <Card title="🐌 Not Selling — maybe offer a discount">
          {slow.length === 0 ? <Empty>Everything is moving 👍</Empty> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slow.map((f) => (
                <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.03)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{f.inStock} sitting in stock</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

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
        {flows.length === 0 ? <Empty>No products yet. Add stock in Inventory or Purchase.</Empty> : (
          <div className="table-wrap">
            <table className="dt">
              <thead><tr><th>Product</th><th className="r">In Stock</th><th className="r">Sold (Month)</th><th>Status</th></tr></thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={f.name}>
                    <td><strong>{f.name}</strong></td>
                    <td className="r" style={{ color: f.inStock <= 0 ? 'var(--red)' : undefined, fontWeight: 600 }}>{f.inStock}</td>
                    <td className="r">{f.sold}</td>
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
