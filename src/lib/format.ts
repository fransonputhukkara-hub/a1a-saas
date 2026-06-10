import type { Invoice, LineItem } from './types'

/** Shop fields needed to render a bill / message. */
export interface ShopLike {
  name: string
  location: string
  phone: string
  instagram_link?: string | null
  facebook_link?: string | null
  google_link?: string | null
  website_link?: string | null
}

/** Format a number as Indian Rupees, e.g. 124000 -> "₹1,24,000". */
export function inr(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

/** Compact INR: 124000 -> "₹1.24L", 6800 -> "₹6,800". */
export function inrShort(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + 'Cr'
  if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + 'L'
  if (v >= 1000) return '₹' + (v / 1000).toFixed(1) + 'k'
  return inr(v)
}

/** Today's date as YYYY-MM-DD (local). */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** Format an ISO date/timestamp as "07 Jun". */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

/** Full date "07 Jun 2025". */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Current month key "2025-06" and label "June 2025". */
export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function monthLabel(d = new Date()): string {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false
  return monthKey(new Date(iso)) === monthKey()
}

export function lineTotal(items: LineItem[]): number {
  return items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0)
}

/** Build a single vCard (.vcf) entry for a customer. */
export function customerVCard(name: string, phone: string | null | undefined, shopName?: string): string {
  const tel = (phone ?? '').trim()
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `N:${name};;;;`,
    tel ? `TEL;TYPE=CELL:${tel}` : '',
    shopName ? `NOTE:Customer of ${shopName}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\r\n')
}

/** Trigger a download of a .vcf contact file in the browser. */
export function downloadVcf(filename: string, vcards: string) {
  const blob = new Blob([vcards], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.vcf') ? filename : `${filename}.vcf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Parse a .vcf file's text into { name, phone } contacts. */
export function parseVCards(text: string): { name: string; phone: string | null }[] {
  const out: { name: string; phone: string | null }[] = []
  const cards = text.split(/BEGIN:VCARD/i).slice(1)
  for (const card of cards) {
    let name = ''
    let phone: string | null = null
    for (const raw of card.split(/\r?\n/)) {
      const line = raw.trim()
      const colon = line.indexOf(':')
      if (colon < 0) continue
      const key = line.slice(0, colon).toUpperCase()
      const value = line.slice(colon + 1).trim()
      if (key === 'FN' && value) name = value
      else if (key.startsWith('N') && !name && value) name = value.replace(/;/g, ' ').trim()
      else if (key.startsWith('TEL') && !phone && value) phone = value
    }
    if (name || phone) out.push({ name: name || 'Unnamed', phone: phone || null })
  }
  return out
}

/** Build a wa.me link with a pre-filled, URL-encoded message. */
export function whatsappLink(phone: string | null | undefined, message: string): string {
  const digits = (phone ?? '').replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/** Standard invoice WhatsApp message. */
export function invoiceMessage(inv: Invoice, shop: ShopLike): string {
  const lines = inv.items
    .map((it) => `• ${it.name} x${it.qty} — ${inr(Number(it.qty) * Number(it.rate))}`)
    .join('\n')
  const balanceLine = Number(inv.balance_due) > 0
    ? `Balance Due: ${inr(inv.balance_due)}\n`
    : `Paid in Full ✓\n`
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link = inv.id ? `\n🧾 View invoice: ${origin}/i/${inv.id}\n` : ''

  const socials: string[] = []
  if (shop.website_link) socials.push(`🛍️ Shop online:\n${shop.website_link}`)
  if (shop.google_link) socials.push(`⭐ Rate us on Google:\n${shop.google_link}`)
  if (shop.instagram_link) socials.push(`📸 Instagram:\n${shop.instagram_link}`)
  if (shop.facebook_link) socials.push(`👍 Facebook:\n${shop.facebook_link}`)
  const socialBlock = socials.length ? `\n— Stay connected —\n${socials.join('\n')}\n` : ''

  return (
    `🏪 ${shop.name}\n` +
    `${shop.location.split(',')[0]} | ${shop.phone}\n\n` +
    `Invoice: #${inv.invoice_number}\n` +
    `Customer: ${inv.customer_name ?? ''}\n\n` +
    `Items:\n${lines}\n\n` +
    `Total: ${inr(inv.total)}\n` +
    `Paid (${inv.payment_method}): ${inr(inv.advance)}\n` +
    balanceLine +
    `\nDelivery: ${longDate(inv.delivery_date)}\n` +
    link +
    socialBlock +
    `\nThank you! 🙏`
  )
}
