import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Settings as SettingsRow } from '../lib/types'
import { Card, PageHeader, Field, Input, ToggleRow, Empty } from '../components/ui'
import { useShop } from '../lib/ShopContext'

type Tab = 'shop' | 'invoice' | 'whatsapp' | 'notifications' | 'plan'

const TABS: { id: Tab; label: string }[] = [
  { id: 'shop', label: '🏪 Shop Profile' },
  { id: 'invoice', label: '🧾 Invoice Settings' },
  { id: 'whatsapp', label: '💬 WhatsApp' },
  { id: 'notifications', label: '🔔 Notifications' },
  { id: 'plan', label: '💳 Plan & Billing' },
]

export default function Settings() {
  const { refresh: refreshShop } = useShop()
  const [tab, setTab] = useState<Tab>('shop')
  const [settings, setSettings] = useState<SettingsRow | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    waReminders: true, lowStock: true, lostCustomers: true, loyalty: false,
    showLogo: true, showBalance: true, showDelivery: true, duplicateCopy: false,
    waInvoice: true, waDelivery: true, waBalance: true, waFestival: false, waWinback: false,
    nLowStock: true, nOverdue: true, nDaily: true, nNewCust: false, nDelivery: true,
  })

  async function load() {
    const { data: s } = await supabase.from('settings').select('*').eq('id', 1).single()
    setSettings(s as SettingsRow)
  }
  useEffect(() => { load() }, [])

  async function saveSettings() {
    if (!settings) return
    await supabase.from('settings').update({
      shop_name: settings.shop_name,
      owner: settings.owner,
      phone: settings.phone,
      location: settings.location,
      invoice_prefix: settings.invoice_prefix,
      invoice_footer: settings.invoice_footer,
      instagram_link: settings.instagram_link || null,
      facebook_link: settings.facebook_link || null,
      google_link: settings.google_link || null,
      website_link: settings.website_link || null,
    }).eq('id', 1)
    refreshShop()
    setMsg('Settings saved ✅')
    setTimeout(() => setMsg(null), 2500)
  }

  async function uploadLogo(file: File) {
    if (!settings) return
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `shop-logo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (upErr) { setMsg('Logo upload failed: ' + upErr.message); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    const url = data.publicUrl
    setSettings((s) => (s ? { ...s, logo_url: url } : s))
    await supabase.from('settings').update({ logo_url: url }).eq('id', 1)
    refreshShop()
    setMsg('Logo updated ✅')
    setTimeout(() => setMsg(null), 2500)
  }

  async function removeLogo() {
    setSettings((s) => (s ? { ...s, logo_url: null } : s))
    await supabase.from('settings').update({ logo_url: null }).eq('id', 1)
    refreshShop()
    setMsg('Logo removed')
    setTimeout(() => setMsg(null), 2500)
  }

  const set = (k: keyof SettingsRow, v: string) => setSettings((s) => (s ? { ...s, [k]: v } : s))
  const tg = (k: string) => (v: boolean) => setToggles((t) => ({ ...t, [k]: v }))

  return (
    <>
      <PageHeader title="Settings" sub="Shop profile, billing & preferences" actions={<button className="btn btn-gold" onClick={saveSettings}>Save Changes</button>} />
      {msg && <div className="alert-strip a-green">{msg}</div>}

      <div className="g-sidebar-l">
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map((t) => (
              <div key={t.id} className={`s-nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</div>
            ))}
          </div>
        </Card>

        <div>
          {!settings ? <Empty>Loading settings…</Empty> : (
            <>
              {tab === 'shop' && (
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid rgba(0,0,0,0.08)', flexWrap: 'wrap' }}>
                    {settings.logo_url ? (
                      <img src={settings.logo_url} alt="logo" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontSize: '1.2rem', color: 'var(--gold)' }}>
                        {settings.shop_name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div className="font-serif" style={{ fontSize: '1.1rem' }}>{settings.shop_name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                          {settings.logo_url ? 'Change Logo' : '⬆ Upload Logo'}
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
                        </label>
                        {settings.logo_url && <button className="btn btn-outline btn-sm btn-danger" onClick={removeLogo}>Remove</button>}
                      </div>
                    </div>
                  </div>
                  <div className="form-row mb16">
                    <Field label="Shop Name"><Input value={settings.shop_name} onChange={(e) => set('shop_name', e.target.value)} /></Field>
                    <Field label="Owner Name"><Input value={settings.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
                  </div>
                  <div className="form-row mb16">
                    <Field label="Phone"><Input value={settings.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
                    <Field label="Location"><Input value={settings.location} onChange={(e) => set('location', e.target.value)} /></Field>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '18px 0 14px' }} />
                  <div className="card-title">Social & Review Links</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 12 }}>
                    Added to the bill (WhatsApp message + invoice page) so customers can follow & review you.
                  </div>
                  <Field label="Google Review Link">
                    <Input value={settings.google_link ?? ''} placeholder="https://g.page/r/…" onChange={(e) => set('google_link', e.target.value)} />
                  </Field>
                  <div style={{ marginTop: 12 }}>
                    <Field label="Shop Website Link">
                      <Input value={settings.website_link ?? ''} placeholder="https://yourshop.com" onChange={(e) => set('website_link', e.target.value)} />
                    </Field>
                  </div>
                  <div className="form-row mb16" style={{ marginTop: 12 }}>
                    <Field label="Instagram Link">
                      <Input value={settings.instagram_link ?? ''} placeholder="https://instagram.com/…" onChange={(e) => set('instagram_link', e.target.value)} />
                    </Field>
                    <Field label="Facebook Link">
                      <Input value={settings.facebook_link ?? ''} placeholder="https://facebook.com/…" onChange={(e) => set('facebook_link', e.target.value)} />
                    </Field>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '18px 0 14px' }} />
                  <div className="card-title">Feature Toggles</div>
                  <ToggleRow label="WhatsApp Auto-Reminders" sub="Auto-send delivery & balance alerts" on={toggles.waReminders} onChange={tg('waReminders')} />
                  <ToggleRow label="Low Stock Alerts" sub="Alert when inventory falls below minimum" on={toggles.lowStock} onChange={tg('lowStock')} />
                  <ToggleRow label="Lost Customer Alerts" sub="Flag customers inactive for 90+ days" on={toggles.lostCustomers} onChange={tg('lostCustomers')} />
                  <ToggleRow label="Loyalty Points" sub="Award points for every ₹100 spent" on={toggles.loyalty} onChange={tg('loyalty')} />
                </Card>
              )}

              {tab === 'invoice' && (
                <Card>
                  <div className="card-title">Invoice Preferences</div>
                  <div className="form-row mb16">
                    <Field label="Invoice Prefix"><Input value={settings.invoice_prefix} onChange={(e) => set('invoice_prefix', e.target.value)} /></Field>
                    <Field label="Next Number"><Input value={String(settings.last_invoice_seq + 1).padStart(4, '0')} readOnly /></Field>
                  </div>
                  <Field label="Invoice Footer Message"><Input value={settings.invoice_footer} onChange={(e) => set('invoice_footer', e.target.value)} /></Field>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>
                    Invoices are numbered <strong>{settings.invoice_prefix}-{new Date().getFullYear()}-0001</strong> and increment automatically.
                  </div>
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '18px 0 14px' }} />
                  <div className="card-title">Print Settings</div>
                  <ToggleRow label="Show Shop Logo on Invoice" on={toggles.showLogo} onChange={tg('showLogo')} />
                  <ToggleRow label="Show Balance Due" on={toggles.showBalance} onChange={tg('showBalance')} />
                  <ToggleRow label="Show Delivery Date" on={toggles.showDelivery} onChange={tg('showDelivery')} />
                  <ToggleRow label="Duplicate Copy Print" sub="Print customer + shop copy together" on={toggles.duplicateCopy} onChange={tg('duplicateCopy')} />
                </Card>
              )}

              {tab === 'whatsapp' && (
                <Card>
                  <div className="card-title">WhatsApp Configuration</div>
                  <div className="form-row mb16">
                    <Field label="Business WhatsApp Number"><Input value={settings.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
                    <Field label="Business Name"><Input value={settings.shop_name} onChange={(e) => set('shop_name', e.target.value)} /></Field>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '18px 0 14px' }} />
                  <div className="card-title">Auto Message Triggers</div>
                  <ToggleRow label="Send Invoice on Bill Create" on={toggles.waInvoice} onChange={tg('waInvoice')} />
                  <ToggleRow label="Delivery Ready Alert" on={toggles.waDelivery} onChange={tg('waDelivery')} />
                  <ToggleRow label="Balance Due Reminder" on={toggles.waBalance} onChange={tg('waBalance')} />
                  <ToggleRow label="Festival Campaign" on={toggles.waFestival} onChange={tg('waFestival')} />
                  <ToggleRow label="Lost Customer Win-back" on={toggles.waWinback} onChange={tg('waWinback')} />
                </Card>
              )}

              {tab === 'notifications' && (
                <Card>
                  <div className="card-title">Notification Preferences</div>
                  <ToggleRow label="Low Stock Alert" on={toggles.nLowStock} onChange={tg('nLowStock')} />
                  <ToggleRow label="Overdue Payment Alert" on={toggles.nOverdue} onChange={tg('nOverdue')} />
                  <ToggleRow label="Daily Sales Summary" on={toggles.nDaily} onChange={tg('nDaily')} />
                  <ToggleRow label="New Customer Alert" on={toggles.nNewCust} onChange={tg('nNewCust')} />
                  <ToggleRow label="Delivery Due Today" on={toggles.nDelivery} onChange={tg('nDelivery')} />
                </Card>
              )}

              {tab === 'plan' && (
                <Card>
                  <div className="card-title">Current Plan</div>
                  <div style={{ background: 'linear-gradient(135deg,var(--ink),#2a2a4a)', borderRadius: 14, padding: 22, color: '#fff', marginBottom: 20 }}>
                    <div className="font-serif" style={{ fontSize: '1.3rem', color: 'var(--gold-soft)' }}>St. Thomas Business Suite</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Self-hosted · Single shop</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 12 }}>Owned <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>/ no subscription</span></div>
                  </div>
                  <div className="card-title">Included</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['Unlimited Invoices', 'Unlimited Customers', 'WhatsApp Remarketing', 'Inventory Management', 'Reports & Analytics', 'Expenses Management'].map((f) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}><span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span> {f}</div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
