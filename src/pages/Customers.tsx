import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Customer, Invoice } from '../lib/types'
import { inr, shortDate, longDate } from '../lib/format'
import { Card, PageHeader, Pill, Field, Input, Empty } from '../components/ui'

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [selected, setSelected] = useState<Customer | null>(null)
  const [history, setHistory] = useState<Invoice[]>([])

  async function load() {
    setLoading(true)
    const [{ data: custs }, { data: invs }] = await Promise.all([
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('customer_id, balance_due'),
    ])
    setCustomers((custs as Customer[]) ?? [])
    const bal: Record<string, number> = {}
    for (const inv of (invs as Invoice[]) ?? []) {
      if (inv.customer_id) bal[inv.customer_id] = (bal[inv.customer_id] ?? 0) + Number(inv.balance_due)
    }
    setBalances(bal)
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function addCustomer() {
    if (!form.name.trim()) return
    await supabase.from('customers').insert({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    })
    setForm({ name: '', phone: '', address: '' })
    setAdding(false)
    load()
  }

  async function openHistory(c: Customer) {
    setSelected(c)
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
    setHistory((data as Invoice[]) ?? [])
  }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(search) ||
      (c.address ?? '').toLowerCase().includes(q)
    )
  })

  function statusFor(c: Customer): { tone: 'green' | 'gold' | 'red' | 'purple'; label: string } {
    if ((balances[c.id] ?? 0) > 0) return { tone: 'red', label: 'Balance Due' }
    if (c.total_orders >= 5) return { tone: 'purple', label: 'VIP' }
    return { tone: 'green', label: 'Active' }
  }

  const newThisMonth = customers.filter((c) => {
    const d = new Date(c.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <>
      <PageHeader
        title="Customers"
        sub={`${customers.length} registered · ${newThisMonth} new this month`}
        actions={
          <button className="btn btn-gold" onClick={() => setAdding((v) => !v)}>
            ＋ Add Customer
          </button>
        }
      />

      {adding && (
        <Card title="New Customer" className="mb16">
          <div className="form-row3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} placeholder="+91…" onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Location / Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={addCustomer}>Save Customer</button>
            <button className="btn btn-outline" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </Card>
      )}

      <div className="glass-card search-bar">
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input placeholder="Search by name, phone or area…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        {loading ? (
          <Empty>Loading customers…</Empty>
        ) : filtered.length === 0 ? (
          <Empty>No customers yet. Add your first one!</Empty>
        ) : (
          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr><th>Customer</th><th>Phone</th><th>Location</th><th className="r">Orders</th><th className="r">Lifetime</th><th className="r">Balance</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const st = statusFor(c)
                  const bal = balances[c.id] ?? 0
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openHistory(c)}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.phone ?? '—'}</td>
                      <td>{c.address ?? '—'}</td>
                      <td className="r">{c.total_orders}</td>
                      <td className="r">{inr(c.lifetime_value)}</td>
                      <td className="r" style={{ color: bal > 0 ? 'var(--red)' : undefined }}>{bal > 0 ? inr(bal) : '—'}</td>
                      <td><Pill tone={st.tone}>{st.label}</Pill></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => navigate('/sale')}>New Bill</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <div
          className="no-print"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelected(null)}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="font-serif" style={{ fontSize: '1.2rem' }}>{selected.name}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                  {selected.phone ?? '—'} · {selected.address ?? '—'} · Joined {longDate(selected.created_at)}
                </div>
              </div>
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="g3 mb16">
              <div className="kpi-tile"><div className="kpi-val">{selected.total_orders}</div><div className="kpi-key">Orders</div></div>
              <div className="kpi-tile"><div className="kpi-val">{inr(selected.lifetime_value)}</div><div className="kpi-key">Lifetime</div></div>
              <div className="kpi-tile"><div className="kpi-val" style={{ color: 'var(--red)' }}>{inr(balances[selected.id] ?? 0)}</div><div className="kpi-key">Balance</div></div>
            </div>
            <div className="card-title">Invoice History</div>
            {history.length === 0 ? (
              <Empty>No invoices for this customer yet.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr><th>Invoice</th><th>Date</th><th className="r">Total</th><th className="r">Balance</th></tr></thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td><strong>{h.invoice_number}</strong></td>
                        <td>{shortDate(h.created_at)}</td>
                        <td className="r">{inr(h.total)}</td>
                        <td className="r" style={{ color: Number(h.balance_due) > 0 ? 'var(--red)' : undefined }}>{Number(h.balance_due) > 0 ? inr(h.balance_due) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
