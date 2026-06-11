import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Customer, Invoice, WhatsappTemplate } from '../lib/types'
import { inr, whatsappLink } from '../lib/format'
import { useShop } from '../lib/ShopContext'
import { Card, PageHeader, Pill, Empty } from '../components/ui'

type SegmentId = 'all' | 'vip' | 'lost' | 'balance'

interface Enriched extends Customer {
  balance: number
  lastOrder: number | null
}

// Built-in starter templates, seeded into the DB on first use.
const SEED_TEMPLATES = [
  { title: '🎉 Festival Collection', body: 'Good day [Name]! 🌟 New collection just arrived at [Shop]. Come visit us! 👔' },
  { title: '💰 Balance Reminder', body: 'Hi [Name]! Your order at [Shop] is ready. A balance of ₹[Amt] is pending — please settle & collect. 😊' },
  { title: '💔 Win-Back', body: 'We miss you [Name]! 😢 New collections have arrived at [Shop]. Visit us for a special discount! 🎁' },
]

export default function WhatsApp() {
  const { shop } = useShop()
  const [customers, setCustomers] = useState<Enriched[]>([])
  const [segment, setSegment] = useState<SegmentId>('all')
  const [loading, setLoading] = useState(true)

  // Templates (persisted in DB)
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tmplMsg, setTmplMsg] = useState<string | null>(null)

  // Selection + send-queue state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [queue, setQueue] = useState<Enriched[] | null>(null)
  const [qIndex, setQIndex] = useState(0)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)

  async function loadTemplates() {
    let { data } = await supabase.from('whatsapp_templates').select('*').order('created_at')
    let rows = (data as WhatsappTemplate[]) ?? []
    // Seed the starter templates the first time.
    if (rows.length === 0) {
      await supabase.from('whatsapp_templates').insert(SEED_TEMPLATES)
      const res = await supabase.from('whatsapp_templates').select('*').order('created_at')
      rows = (res.data as WhatsappTemplate[]) ?? []
    }
    setTemplates(rows)
    if (rows.length && !selectedId) selectTemplate(rows[0])
  }

  useEffect(() => {
    loadTemplates()
    Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('invoices').select('customer_id, balance_due, created_at'),
    ]).then(([c, i]) => {
      const custs = (c.data as Customer[]) ?? []
      const invs = (i.data as Pick<Invoice, 'customer_id' | 'balance_due' | 'created_at'>[]) ?? []
      const enriched: Enriched[] = custs.map((cust) => {
        const mine = invs.filter((x) => x.customer_id === cust.id)
        const balance = mine.reduce((s, x) => s + Number(x.balance_due), 0)
        const lastOrder = mine.length ? Math.max(...mine.map((x) => new Date(x.created_at).getTime())) : null
        return { ...cust, balance, lastOrder }
      })
      setCustomers(enriched)
      setLoading(false)
    })
  }, [])

  function flash(m: string) { setTmplMsg(m); setTimeout(() => setTmplMsg(null), 2000) }

  function selectTemplate(t: WhatsappTemplate) {
    setSelectedId(t.id)
    setTitle(t.title)
    setBody(t.body)
  }
  function newTemplate() {
    setSelectedId(null)
    setTitle('')
    setBody('')
  }
  async function saveAsNew() {
    if (!title.trim() || !body.trim()) return flash('Add a title and message first.')
    const { data } = await supabase.from('whatsapp_templates').insert({ title: title.trim(), body: body.trim() }).select().single()
    await loadTemplates()
    if (data) setSelectedId((data as WhatsappTemplate).id)
    flash('Template saved ✅')
  }
  async function updateTemplate() {
    if (!selectedId) return saveAsNew()
    if (!title.trim() || !body.trim()) return flash('Add a title and message first.')
    await supabase.from('whatsapp_templates').update({ title: title.trim(), body: body.trim() }).eq('id', selectedId)
    await loadTemplates()
    flash('Template updated ✅')
  }
  async function deleteTemplate() {
    if (!selectedId) return
    if (!window.confirm('Delete this template?')) return
    await supabase.from('whatsapp_templates').delete().eq('id', selectedId)
    setSelectedId(null); setTitle(''); setBody('')
    await loadTemplates()
    flash('Template deleted')
  }

  const now = Date.now()
  const NINETY = 90 * 24 * 60 * 60 * 1000

  const segments = useMemo(() => ({
    all: customers,
    vip: customers.filter((c) => c.total_orders >= 5),
    lost: customers.filter((c) => c.lastOrder !== null && now - c.lastOrder > NINETY),
    balance: customers.filter((c) => c.balance > 0),
  }), [customers, now, NINETY])

  const list = segments[segment]
  // DPDP Act 2023 — only message customers with a phone AND consent.
  const withPhone = list.filter((c) => c.phone && c.consent)

  function messageFor(c: Enriched) {
    return body
      .replace(/\[Name\]/g, c.name.split(' ')[0])
      .replace(/\[Amt\]/g, String(c.balance))
      .replace(/\[Shop\]/g, shop.name)
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function selectAll() {
    setSelected(new Set(withPhone.map((c) => c.id)))
  }
  function clearSel() {
    setSelected(new Set())
  }

  const chosen = withPhone.filter((c) => selected.has(c.id))

  // ── Send queue ──
  function startSend() {
    if (chosen.length === 0) return
    setQueue(chosen)
    setQIndex(0)
    setSentIds(new Set())
    setDone(false)
    openChat(chosen[0])
  }
  function openChat(c: Enriched) {
    window.open(whatsappLink(c.phone, messageFor(c)), '_blank')
  }
  function sentNext() {
    if (!queue) return
    const cur = queue[qIndex]
    setSentIds((s) => new Set(s).add(cur.id))
    advance(qIndex + 1)
  }
  function skip() {
    if (!queue) return
    advance(qIndex + 1)
  }
  function advance(next: number) {
    if (!queue) return
    if (next >= queue.length) { setDone(true); setQueue(null); return }
    setQIndex(next)
    openChat(queue[next])
  }
  function stopQueue() {
    setQueue(null)
  }

  const segDefs: { id: SegmentId; label: string; tone: 'green' | 'purple' | 'red' | 'orange' }[] = [
    { id: 'all', label: `All (${segments.all.length})`, tone: 'green' },
    { id: 'vip', label: `VIP 5+ (${segments.vip.length})`, tone: 'purple' },
    { id: 'lost', label: `Lost 90+ days (${segments.lost.length})`, tone: 'red' },
    { id: 'balance', label: `Balance Due (${segments.balance.length})`, tone: 'orange' },
  ]

  // ── Active send-queue overlay ──
  if (queue) {
    const cur = queue[qIndex]
    const pct = Math.round((qIndex / queue.length) * 100)
    return (
      <>
        <PageHeader title="Sending…" sub="Tap Send in WhatsApp, then come back & press Next" actions={<button className="btn btn-outline" onClick={stopQueue}>Stop</button>} />
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Sending {qIndex + 1} of {queue.length}</div>
              <div style={{ height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 6, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#25d366', transition: 'width 0.3s' }} />
              </div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div className="font-serif" style={{ fontSize: '1.2rem' }}>{cur.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{cur.phone}</div>
            </div>
            <div style={{ background: '#e5ddd5', borderRadius: 12, padding: 12, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#303030', marginBottom: 14 }}>
              {messageFor(cur)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-gold" style={{ width: '100%' }} onClick={() => openChat(cur)}>📲 Open WhatsApp again</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={skip}>Skip</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={sentNext}>✓ Sent — Next</button>
              </div>
            </div>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="WhatsApp Remarketing" sub="Bulk campaigns · Recover lost customers · Collect balances" />
      {done && (
        <div className="alert-strip a-green"><strong>Done!</strong> Sent {sentIds.size} message{sentIds.size === 1 ? '' : 's'}. 🎉</div>
      )}
      <div className="alert-strip a-green">
        <strong>How it works:</strong> Pick a template, choose recipients, then <strong>Start Bulk Send</strong>. Each chat opens with the message ready — tap send in WhatsApp and press “Sent — Next”. No API, no cost.
      </div>

      <div className="g-sidebar-l">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="1 · Segment">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {segDefs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSegment(s.id); clearSel() }}
                  className={`pill p-${s.tone}`}
                  style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.75rem', border: segment === s.id ? '2px solid var(--ink)' : '2px solid transparent' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Card>
          <Card title="2 · Message Templates">
            {tmplMsg && <div className="alert-strip a-green" style={{ marginBottom: 10 }}>{tmplMsg}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Saved Templates</span>
              <button className="btn btn-outline btn-sm" onClick={newTemplate}>＋ New</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {templates.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>No templates yet — create one below.</div>
              ) : templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  style={{
                    textAlign: 'left', padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    background: selectedId === t.id ? 'var(--green-l)' : 'rgba(255,255,255,0.5)',
                    border: `1.5px solid ${selectedId === t.id ? 'var(--green)' : 'rgba(0,0,0,0.08)'}`,
                  }}
                >
                  {t.title}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {selectedId ? 'Edit Template' : 'New Template'}
              </div>
              <input
                className="glass-input"
                value={title}
                placeholder="Template name (e.g. Diwali Offer)"
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', marginBottom: 8, fontSize: '0.82rem' }}
              />
              <textarea
                className="glass-input"
                value={body}
                placeholder="Type your message…"
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.82rem', lineHeight: 1.5 }}
              />
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', margin: '6px 0 10px' }}>
                Tags: <strong>[Name]</strong> = customer name · <strong>[Amt]</strong> = balance · <strong>[Shop]</strong> = shop name
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedId && <button className="btn btn-gold btn-sm" onClick={updateTemplate}>Save Changes</button>}
                <button className="btn btn-outline btn-sm" onClick={saveAsNew}>Save as New</button>
                {selectedId && <button className="btn btn-outline btn-sm btn-danger" onClick={deleteTemplate}>Delete</button>}
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="3 · Recipients">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--ink)' }}>{chosen.length}</strong> selected · {withPhone.length} with phone
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={selectAll}>Select all</button>
                <button className="btn btn-outline btn-sm" onClick={clearSel}>Clear</button>
              </div>
            </div>
            {loading ? <Empty>Loading customers…</Empty> : withPhone.length === 0 ? <Empty>No customers with WhatsApp consent in this segment (DPDP Act 2023).</Empty> : (
              <div className="table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="dt">
                  <thead><tr><th style={{ width: 32 }}></th><th>Customer</th><th>Phone</th><th className="r">Balance</th></tr></thead>
                  <tbody>
                    {withPhone.map((c) => (
                      <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => toggle(c.id)}>
                        <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} /></td>
                        <td><strong>{c.name}</strong>{c.total_orders >= 5 && <span style={{ marginLeft: 6 }}><Pill tone="purple">VIP</Pill></span>}</td>
                        <td>{c.phone}</td>
                        <td className="r" style={{ color: c.balance > 0 ? 'var(--red)' : undefined }}>{c.balance > 0 ? inr(c.balance) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              className="btn btn-gold"
              style={{ width: '100%', marginTop: 14 }}
              disabled={chosen.length === 0}
              onClick={startSend}
            >
              📲 Start Bulk Send ({chosen.length})
            </button>
          </Card>
        </div>
      </div>
    </>
  )
}
