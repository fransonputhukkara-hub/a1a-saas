import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InventoryItem } from '../lib/types'
import { inr } from '../lib/format'
import { Card, PageHeader, Pill, Kpi, Field, Input, Select, Empty } from '../components/ui'
import { Barcode, generateBarcode } from '../components/Barcode'
import { SHOP } from '../lib/supabase'

const emptyForm = {
  id: '' as string | '',
  name: '', sku: '', category: 'Fabric', barcode: '',
  in_stock: 0, min_level: 5, buying_rate: 0, selling_rate: 0,
}

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [labelMode, setLabelMode] = useState(false)
  const [labelPicks, setLabelPicks] = useState<Record<string, number>>({})

  function load() {
    setLoading(true)
    supabase.from('inventory').select('*').order('name').then(({ data }) => {
      setItems((data as InventoryItem[]) ?? [])
      setLoading(false)
    })
  }
  useEffect(load, [])

  function statusOf(it: InventoryItem): { tone: 'green' | 'gold' | 'red' | 'teal'; label: string } {
    if (it.category === 'Stitching' || it.category === 'Service') return { tone: 'teal', label: 'Service' }
    if (Number(it.in_stock) <= 0) return { tone: 'red', label: 'Out of Stock' }
    if (Number(it.in_stock) <= Number(it.min_level) / 2) return { tone: 'red', label: 'Critical' }
    if (Number(it.in_stock) <= Number(it.min_level)) return { tone: 'gold', label: 'Low' }
    return { tone: 'green', label: 'In Stock' }
  }

  async function saveForm() {
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      category: form.category,
      barcode: form.barcode.trim() || generateBarcode(),
      in_stock: Number(form.in_stock),
      min_level: Number(form.min_level),
      buying_rate: Number(form.buying_rate),
      selling_rate: Number(form.selling_rate),
    }
    if (form.id) await supabase.from('inventory').update(payload).eq('id', form.id)
    else await supabase.from('inventory').insert(payload)
    setShowForm(false)
    setForm({ ...emptyForm })
    load()
  }

  function edit(it: InventoryItem) {
    setForm({
      id: it.id, name: it.name, sku: it.sku ?? '', category: it.category ?? 'Fabric',
      barcode: it.barcode ?? '',
      in_stock: Number(it.in_stock), min_level: Number(it.min_level),
      buying_rate: Number(it.buying_rate), selling_rate: Number(it.selling_rate),
    })
    setShowForm(true)
  }

  async function ensureBarcode(it: InventoryItem) {
    if (it.barcode) return
    const bc = generateBarcode()
    await supabase.from('inventory').update({ barcode: bc }).eq('id', it.id)
    setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, barcode: bc } : x)))
  }

  const filtered = items.filter((it) => {
    const q = search.toLowerCase()
    return (
      it.name.toLowerCase().includes(q) ||
      (it.sku ?? '').toLowerCase().includes(q) ||
      (it.category ?? '').toLowerCase().includes(q) ||
      (it.barcode ?? '').toLowerCase().includes(q)
    )
  })

  const lowCount = items.filter((i) => Number(i.in_stock) > 0 && Number(i.in_stock) <= Number(i.min_level) && i.category !== 'Stitching').length
  const outCount = items.filter((i) => Number(i.in_stock) <= 0 && i.category !== 'Stitching' && i.category !== 'Service').length
  const stockValue = items.reduce((s, i) => s + Number(i.in_stock) * Number(i.buying_rate), 0)
  const categories = ['Fabric', 'Readymade', 'Stitching', 'Accessories', 'Service', 'Uncategorised']

  // Build the print sheet from the user's selection.
  const labelEntries = Object.entries(labelPicks)
    .filter(([, n]) => n > 0)
    .flatMap(([id, n]) => {
      const it = items.find((x) => x.id === id)
      if (!it || !it.barcode) return []
      return Array.from({ length: n }, () => it)
    })

  if (labelMode) {
    return (
      <>
        <PageHeader
          title="Print Barcode Labels"
          sub={`${labelEntries.length} labels ready`}
          actions={
            <>
              <button className="btn btn-outline" onClick={() => setLabelMode(false)}>← Back</button>
              <button className="btn btn-primary" onClick={() => window.print()} disabled={labelEntries.length === 0}>
                🖨 Print
              </button>
            </>
          }
        />
        {labelEntries.length === 0 ? (
          <Card><Empty>Pick label counts on the Inventory screen, then come back here to print.</Empty></Card>
        ) : (
          <Card>
            <div className="label-sheet">
              {labelEntries.map((it, i) => (
                <div className="label" key={i}>
                  <div className="label-name">{it.name}</div>
                  <Barcode value={it.barcode!} height={42} fontSize={11} />
                  <div className="label-price">{inr(it.selling_rate)}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>{SHOP.name}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        sub={`${items.length} items across ${new Set(items.map((i) => i.category)).size} categories`}
        actions={
          <>
            <button className="btn btn-outline" onClick={() => setLabelMode(true)}>🏷 Print Labels</button>
            <button className="btn btn-gold" onClick={() => { setForm({ ...emptyForm, barcode: generateBarcode() }); setShowForm((v) => !v) }}>＋ Add Product</button>
          </>
        }
      />

      <div className="g4 mb16">
        <Kpi value={String(items.length)} label="Total Items" />
        <Kpi value={String(lowCount)} label="Low Stock" color="var(--red)" />
        <Kpi value={inr(stockValue)} label="Stock Value" color="var(--green)" />
        <Kpi value={String(outCount)} label="Out of Stock" color="var(--gold)" />
      </div>

      {showForm && (
        <Card title={form.id ? 'Edit Product' : 'Add Product'} className="mb16">
          <div className="form-row3">
            <Field label="Product Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Barcode">
              <div style={{ display: 'flex', gap: 8 }}>
                <Input value={form.barcode} placeholder="Scan or enter…" onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <button className="btn btn-outline" type="button" onClick={() => setForm({ ...form, barcode: generateBarcode() })}>Generate</button>
              </div>
              {form.barcode && (
                <div style={{ marginTop: 8, background: '#fff', borderRadius: 8, padding: '4px 8px', display: 'inline-block' }}>
                  <Barcode value={form.barcode} height={40} fontSize={11} />
                </div>
              )}
            </Field>
            <div />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <Field label="In Stock"><Input type="number" value={form.in_stock} onChange={(e) => setForm({ ...form, in_stock: Number(e.target.value) })} /></Field>
            <Field label="Min Level"><Input type="number" value={form.min_level} onChange={(e) => setForm({ ...form, min_level: Number(e.target.value) })} /></Field>
            <Field label="Buying Rate"><Input type="number" value={form.buying_rate} onChange={(e) => setForm({ ...form, buying_rate: Number(e.target.value) })} /></Field>
            <Field label="Selling Rate"><Input type="number" value={form.selling_rate} onChange={(e) => setForm({ ...form, selling_rate: Number(e.target.value) })} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button className="btn btn-primary" onClick={saveForm}>{form.id ? 'Update' : 'Save'} Product</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </Card>
      )}

      <div className="glass-card search-bar">
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input placeholder="Search by name, SKU, category or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        {loading ? <Empty>Loading inventory…</Empty> : filtered.length === 0 ? <Empty>No products yet.</Empty> : (
          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr><th>Barcode</th><th>Product</th><th>Category</th><th className="r">In Stock</th><th className="r">Min</th><th className="r">Selling</th><th>Status</th><th className="c">Labels</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const st = statusOf(it)
                  const low = st.label === 'Critical' || st.label === 'Out of Stock' || st.label === 'Low'
                  return (
                    <tr key={it.id} style={low ? { background: 'var(--red-l)' } : undefined}>
                      <td>
                        {it.barcode ? (
                          <div style={{ background: '#fff', borderRadius: 6, padding: '2px 4px', display: 'inline-block' }}>
                            <Barcode value={it.barcode} height={28} fontSize={9} width={1.1} />
                          </div>
                        ) : (
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.68rem' }} onClick={() => ensureBarcode(it)}>Generate</button>
                        )}
                      </td>
                      <td><strong>{it.name}</strong>{it.sku && <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{it.sku}</div>}</td>
                      <td>{it.category ?? '—'}</td>
                      <td className="r">{Number(it.in_stock)}</td>
                      <td className="r">{Number(it.min_level)}</td>
                      <td className="r">{inr(it.selling_rate)}</td>
                      <td><Pill tone={st.tone}>{st.label}</Pill></td>
                      <td className="c">
                        <Input
                          type="number" min={0} max={50}
                          value={labelPicks[it.id] ?? 0}
                          onChange={(e) => setLabelPicks((p) => ({ ...p, [it.id]: Math.max(0, Number(e.target.value)) }))}
                          style={{ width: 56, padding: '4px 6px', textAlign: 'center' }}
                          disabled={!it.barcode}
                        />
                      </td>
                      <td><button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => edit(it)}>Edit</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
