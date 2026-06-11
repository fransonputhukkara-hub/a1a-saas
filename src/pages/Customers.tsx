import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Customer, Invoice } from '../lib/types'
import { inr, shortDate, longDate, customerVCard, downloadVcf, parseVCards } from '../lib/format'
import { Card, PageHeader, Pill, Field, Input, Empty } from '../components/ui'
import { useShop } from '../lib/ShopContext'

export default function Customers() {
  const navigate = useNavigate()
  const { shop } = useShop()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '+91 ', address: '', consent: false })
  const [selected, setSelected] = useState<Customer | null>(null)
  const [history, setHistory] = useState<Invoice[]>([])
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

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
    const name = form.name.trim()
    const phone = form.phone.trim() === '+91' ? '' : form.phone.trim()
    await supabase.from('customers').insert({
      name,
      phone: phone || null,
      address: form.address.trim() || null,
      consent: form.consent,
    })
    // Offer to save the new customer straight to the phone's contacts so
    // WhatsApp shows their name. (Downloads a .vcf the owner taps to import.)
    if (phone) downloadVcf(`${name}.vcf`, customerVCard(name, phone, shop.name))
    setForm({ name: '', phone: '+91 ', address: '', consent: false })
    setAdding(false)
    load()
  }

  function saveContact(c: Customer) {
    if (!c.phone) return
    downloadVcf(`${c.name}.vcf`, customerVCard(c.name, c.phone, shop.name))
  }
  function exportAllContacts() {
    const withPhone = customers.filter((c) => c.phone)
    if (withPhone.length === 0) return
    const all = withPhone.map((c) => customerVCard(c.name, c.phone, shop.name)).join('\r\n')
    downloadVcf(`${shop.name.replace(/[^\w]+/g, '-')}-contacts.vcf`, all)
  }

  async function importContacts(file: File) {
    setImporting(true)
    try {
      const text = await file.text()
      const parsed = parseVCards(text)
      // Skip contacts whose phone already exists.
      const existingPhones = new Set(customers.map((c) => (c.phone ?? '').replace(/\D/g, '')).filter(Boolean))
      const seen = new Set<string>()
      const rows: { name: string; phone: string | null }[] = []
      let skipped = 0
      for (const p of parsed) {
        const digits = (p.phone ?? '').replace(/\D/g, '')
        if (digits && (existingPhones.has(digits) || seen.has(digits))) { skipped++; continue }
        if (digits) seen.add(digits)
        rows.push({ name: p.name, phone: p.phone })
      }
      if (rows.length > 0) {
        await supabase.from('customers').insert(rows)
      }
      setImportMsg(`Imported ${rows.length} contact${rows.length === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`)
      load()
    } catch {
      setImportMsg('Could not read that file. Make sure it is a .vcf contacts file.')
    } finally {
      setImporting(false)
      setTimeout(() => setImportMsg(null), 4000)
    }
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
          <>
            <label className="btn btn-outline" style={{ cursor: 'pointer' }} title="Import contacts from a .vcf file">
              {importing ? 'Importing…' : '📥 Import Contacts'}
              <input type="file" accept=".vcf,text/vcard" style={{ display: 'none' }} disabled={importing} onChange={(e) => { const f = e.target.files?.[0]; if (f) importContacts(f); e.target.value = '' }} />
            </label>
            <button className="btn btn-outline" onClick={exportAllContacts} title="Download all customers as a .vcf to import into your phone">
              📇 Export Contacts
            </button>
            <button className="btn btn-gold" onClick={() => setAdding((v) => !v)}>
              ＋ Add Customer
            </button>
          </>
        }
      />

      {importMsg && <div className="alert-strip a-green">{importMsg}</div>}

      {adding && (
        <Card title="New Customer" className="mb16">
          <div className="form-row3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} placeholder="+91…" onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Location / Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8rem', margin: '4px 0 14px', cursor: 'pointer', lineHeight: 1.5 }}>
            <input type="checkbox" style={{ marginTop: 3 }} checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
            <span>Customer agrees to receive invoices and promotional offers via WhatsApp <span style={{ color: 'var(--muted)' }}>(As per DPDP Act 2023)</span></span>
          </label>
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
                      <td>
                        <strong>{c.name}</strong>
                        <span title={c.consent ? 'WhatsApp consent given (DPDP)' : 'No WhatsApp consent'} style={{ marginLeft: 6, fontSize: '0.72rem' }}>
                          {c.consent ? '🟢' : '⚪'}
                        </span>
                      </td>
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
                <div style={{ marginTop: 6 }}>
                  <Pill tone={selected.consent ? 'green' : 'gray'}>
                    {selected.consent ? '🟢 WhatsApp consent given' : '⚪ No WhatsApp consent'}
                  </Pill>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selected.phone && <button className="btn btn-gold" onClick={() => saveContact(selected)}>📇 Save Contact</button>}
                <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
            <div className="g3 mb16">
              <div className="kpi-tile"><div className="kpi-val">{selected.total_orders}</div><div className="kpi-key">Orders</div></div>
              <div className="kpi-tile"><div className="kpi-val">{inr(selected.lifetime_value)}</div><div className="kpi-key">Lifetime</div></div>
              <div className="kpi-tile"><div className="kpi-val" style={{ color: 'var(--red)' }}>{inr(balances[selected.id] ?? 0)}</div><div className="kpi-key">Balance</div></div>
            </div>
            {history.length > 0 && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 12, padding: '10px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: 10 }}>
                <span>🛍️ <strong style={{ color: 'var(--ink)' }}>{history.length}</strong> visit{history.length === 1 ? '' : 's'}</span>
                <span>First: <strong style={{ color: 'var(--ink)' }}>{shortDate(history[history.length - 1].created_at)}</strong></span>
                <span>Last: <strong style={{ color: 'var(--ink)' }}>{shortDate(history[0].created_at)}</strong></span>
              </div>
            )}
            <div className="card-title">Visit &amp; Invoice History</div>
            {history.length === 0 ? (
              <Empty>No visits for this customer yet.</Empty>
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
