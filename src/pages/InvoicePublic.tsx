import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Invoice } from '../lib/types'
import { inr, longDate } from '../lib/format'
import { useShop } from '../lib/ShopContext'

/**
 * Public, no-login invoice view opened from the WhatsApp link.
 * Loads a single invoice by its (unguessable) id via the
 * get_public_invoice() security-definer function.
 */
export default function InvoicePublic() {
  const { id } = useParams<{ id: string }>()
  const { shop } = useShop()
  const [inv, setInv] = useState<Invoice | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading')

  useEffect(() => {
    if (!id) { setStatus('missing'); return }
    supabase
      .rpc('get_public_invoice', { inv_id: id })
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : data
        if (error || !row) { setStatus('missing'); return }
        setInv(row as Invoice)
        setStatus('ok')
      })
  }, [id])

  if (status === 'loading') return <div style={wrap}><div style={{ color: '#7a5c4a' }}>Loading invoice…</div></div>
  if (status === 'missing' || !inv) return <div style={wrap}><div style={{ color: '#b42318' }}>Invoice not found.</div></div>

  const balance = Number(inv.balance_due)

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={topBar} />
        <div style={header}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.5rem', fontWeight: 700, color: '#f5d98a', letterSpacing: '0.04em' }}>{shop.name}</div>
          <div style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'rgba(245,217,138,0.75)', marginTop: 4 }}>{shop.location} · {shop.phone}</div>
        </div>

        <div style={metaBar}>
          <div><div style={metaLabel}>Invoice</div><div style={metaVal}>#{inv.invoice_number}</div></div>
          <div><div style={metaLabel}>Date</div><div style={metaVal}>{longDate(inv.created_at)}</div></div>
          <div><div style={metaLabel}>Payment</div><div style={metaVal}>{inv.payment_method}</div></div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={blockLabel}>Billed To</div>
            <div style={{ fontWeight: 600, color: '#4a0f0f', fontSize: '1rem' }}>{inv.customer_name ?? '—'}</div>
            {inv.customer_phone && <div style={{ color: '#7a5c4a', fontSize: '0.85rem' }}>{inv.customer_phone}</div>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#6b1a1a' }}>
                <th style={th}>Item</th>
                <th style={{ ...th, textAlign: 'right' }}>Qty</th>
                <th style={{ ...th, textAlign: 'right' }}>Rate</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(inv.items ?? []).map((it, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f5ead0' }}>
                  <td style={td}>{it.name}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{it.qty}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{inr(it.rate)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{inr(Number(it.qty) * Number(it.rate))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ width: 260 }}>
              <Row label="Subtotal" value={inr(inv.subtotal)} />
              {Number(inv.discount) > 0 && <Row label="Discount" value={`– ${inr(inv.discount)}`} green />}
              <Row label="Total" value={inr(inv.total)} bold />
              <Row label={`Paid (${inv.payment_method})`} value={inr(inv.advance)} green />
              {balance > 0
                ? <Row label="Balance Due" value={inr(balance)} red bold />
                : <Row label="Paid in Full ✓" value="" green bold />}
            </div>
          </div>

          {inv.delivery_date && (
            <div style={{ marginTop: 16, fontSize: '0.82rem', color: '#7a5c4a' }}>
              <strong>Delivery:</strong> {longDate(inv.delivery_date)}
            </div>
          )}
        </div>

        {(shop.website_link || shop.google_link || shop.instagram_link || shop.facebook_link) && (
          <div style={{ padding: '18px 24px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c9921a', marginBottom: 12 }}>Stay Connected With Us</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shop.website_link && (
                <a href={shop.website_link} target="_blank" rel="noopener noreferrer" style={{ ...socialBtn, background: '#6b1a1a', color: '#f5d98a' }}>
                  🛍️ Visit our Website
                </a>
              )}
              {shop.google_link && (
                <a href={shop.google_link} target="_blank" rel="noopener noreferrer" style={{ ...socialBtn, background: '#fff', color: '#3c4043', border: '1px solid #dadce0' }}>
                  <GoogleIcon /> Rate us on Google
                </a>
              )}
              {shop.instagram_link && (
                <a href={shop.instagram_link} target="_blank" rel="noopener noreferrer" style={{ ...socialBtn, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff' }}>
                  <InstaIcon /> Follow on Instagram
                </a>
              )}
              {shop.facebook_link && (
                <a href={shop.facebook_link} target="_blank" rel="noopener noreferrer" style={{ ...socialBtn, background: '#1877f2', color: '#fff' }}>
                  <FbIcon /> Like us on Facebook
                </a>
              )}
            </div>
          </div>
        )}

        <div style={footer}>
          <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'rgba(245,217,138,0.85)' }}>{shop.footer}</div>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: 'rgba(245,217,138,0.45)', marginTop: 8 }}>{shop.name} · {shop.phone}</div>
        </div>
        <div style={botBar} />
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
  )
}
function InstaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
  )
}
function FbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
  )
}

function Row({ label, value, bold, green, red }: { label: string; value: string; bold?: boolean; green?: boolean; red?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed rgba(212,168,83,0.3)', fontSize: '0.85rem', fontWeight: bold ? 700 : 400, color: red ? '#b42318' : green ? '#1a5e3a' : '#4a0f0f' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  )
}

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#4a0f0f', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '24px 12px', fontFamily: 'Georgia, serif' }
const card: React.CSSProperties = { width: '100%', maxWidth: 600, background: '#fffdf7', boxShadow: '0 8px 40px rgba(0,0,0,0.3)', borderRadius: 8, overflow: 'hidden' }
const topBar: React.CSSProperties = { height: 8, background: 'repeating-linear-gradient(90deg,#6b1a1a 0 18px,#c9921a 18px 20px,#6b1a1a 20px 38px,#e8b84b 38px 40px)' }
const botBar: React.CSSProperties = { ...topBar }
const header: React.CSSProperties = { background: '#6b1a1a', padding: '24px', textAlign: 'center' }
const metaBar: React.CSSProperties = { background: '#8b2222', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }
const metaLabel: React.CSSProperties = { fontSize: '0.55rem', letterSpacing: '0.12em', color: 'rgba(245,217,138,0.6)', textTransform: 'uppercase' }
const metaVal: React.CSSProperties = { fontSize: '0.9rem', color: '#f5d98a' }
const blockLabel: React.CSSProperties = { fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c9921a', marginBottom: 4 }
const th: React.CSSProperties = { fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f5d98a', padding: '10px 12px', textAlign: 'left', fontWeight: 600 }
const td: React.CSSProperties = { padding: '11px 12px', fontSize: '0.85rem', color: '#2c1810' }
const footer: React.CSSProperties = { background: '#6b1a1a', padding: '18px 24px', textAlign: 'center' }
const socialBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }
