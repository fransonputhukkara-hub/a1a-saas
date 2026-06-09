import { useEffect, useMemo, useState } from 'react'
import { supabase, SHOP } from '../lib/supabase'
import type { Customer, Invoice } from '../lib/types'
import { inr, whatsappLink } from '../lib/format'
import { Card, PageHeader, Pill, Empty } from '../components/ui'

type SegmentId = 'all' | 'vip' | 'lost' | 'balance'

interface Enriched extends Customer {
  balance: number
  lastOrder: number | null // ms timestamp
}

const TEMPLATES: { id: string; title: string; body: string; tone: 'green' | 'gold' | 'red' }[] = [
  { id: 'festival', title: '🎉 Festival Collection Alert', tone: 'green', body: `Good day [Name] Chetta! 🌟 New collection ready at ${SHOP.name}. Mundu Sets, Suits & Fabrics — ellam und. Varaamo? 👔` },
  { id: 'balance', title: '💰 Balance Reminder', tone: 'gold', body: `Hi [Name] Chetta! Your order is ready at ${SHOP.name}. Balance ₹[Amt] settle cheythu collect cheyyamo? 😊` },
  { id: 'winback', title: '💔 Win-Back', tone: 'red', body: `Ningale kaanaan undaayillalo 😢 Puthiya collections ethi at ${SHOP.name}. Oru visit varaamo? Special discount undaakum! 🎁` },
]

export default function WhatsApp() {
  const [customers, setCustomers] = useState<Enriched[]>([])
  const [segment, setSegment] = useState<SegmentId>('all')
  const [template, setTemplate] = useState(TEMPLATES[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  const now = Date.now()
  const NINETY = 90 * 24 * 60 * 60 * 1000

  const segments = useMemo(() => ({
    all: customers,
    vip: customers.filter((c) => c.total_orders >= 5),
    lost: customers.filter((c) => c.lastOrder !== null && now - c.lastOrder > NINETY),
    balance: customers.filter((c) => c.balance > 0),
  }), [customers, now, NINETY])

  const list = segments[segment]

  function messageFor(c: Enriched) {
    return template.body.replace(/\[Name\]/g, c.name.split(' ')[0]).replace(/\[Amt\]/g, String(c.balance))
  }

  const segDefs: { id: SegmentId; label: string; tone: 'green' | 'purple' | 'red' | 'orange' }[] = [
    { id: 'all', label: `All (${segments.all.length})`, tone: 'green' },
    { id: 'vip', label: `VIP 5+ (${segments.vip.length})`, tone: 'purple' },
    { id: 'lost', label: `Lost 90+ days (${segments.lost.length})`, tone: 'red' },
    { id: 'balance', label: `Balance Due (${segments.balance.length})`, tone: 'orange' },
  ]

  return (
    <>
      <PageHeader title="WhatsApp Remarketing" sub="Send campaigns · Recover lost customers · Collect balances" />
      <div className="alert-strip a-green">
        <strong>Tip:</strong> Clicking a customer opens WhatsApp Web / app with the message pre-filled — no API needed.
      </div>

      <div className="g-sidebar-l">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Segment">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {segDefs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSegment(s.id)}
                  className={`pill p-${s.tone}`}
                  style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.75rem', border: segment === s.id ? '2px solid var(--ink)' : '2px solid transparent' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Card>
          <Card title="Templates">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTemplate(t)}
                  style={{
                    padding: 14, borderRadius: 12, cursor: 'pointer',
                    background: template.id === t.id ? 'var(--green-l)' : 'rgba(255,255,255,0.5)',
                    border: `1.5px solid ${template.id === t.id ? 'var(--green)' : 'rgba(0,0,0,0.08)'}`,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>{t.title}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.5 }}>{t.body}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="WhatsApp Preview">
            <div style={{ background: '#e5ddd5', borderRadius: 16, padding: 14, minHeight: 180 }}>
              <div style={{ background: '#075e54', borderRadius: '10px 10px 0 0', padding: '10px 12px', margin: '-14px -14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>ST</div>
                <div><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>{SHOP.name}</div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.7)' }}>Business Account</div></div>
              </div>
              <div style={{ background: '#fff', borderRadius: '0 10px 10px 10px', padding: '10px 12px', fontSize: '0.78rem', lineHeight: 1.6, color: '#303030', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', maxWidth: '92%', whiteSpace: 'pre-wrap' }}>
                {template.body.replace(/\[Name\]/g, 'Thomas').replace(/\[Amt\]/g, '2,696')}
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>now ✓✓</div>
              </div>
            </div>
          </Card>

          <Card title={`Recipients — ${list.length}`}>
            {loading ? <Empty>Loading customers…</Empty> : list.length === 0 ? <Empty>No customers in this segment.</Empty> : (
              <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                <table className="dt">
                  <thead><tr><th>Customer</th><th>Phone</th><th className="r">Balance</th><th></th></tr></thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong>{c.total_orders >= 5 && <span style={{ marginLeft: 6 }}><Pill tone="purple">VIP</Pill></span>}</td>
                        <td>{c.phone ?? '—'}</td>
                        <td className="r" style={{ color: c.balance > 0 ? 'var(--red)' : undefined }}>{c.balance > 0 ? inr(c.balance) : '—'}</td>
                        <td>
                          {c.phone ? (
                            <a className="btn btn-gold" style={{ padding: '5px 12px', fontSize: '0.72rem' }} href={whatsappLink(c.phone, messageFor(c))} target="_blank" rel="noopener noreferrer">Send</a>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>No phone</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
