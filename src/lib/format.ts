import { SHOP } from './supabase'
import type { Invoice, LineItem } from './types'

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

/** Build a wa.me link with a pre-filled, URL-encoded message. */
export function whatsappLink(phone: string | null | undefined, message: string): string {
  const digits = (phone ?? '').replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/** Standard invoice WhatsApp message. */
export function invoiceMessage(inv: Invoice): string {
  const lines = inv.items
    .map((it) => `• ${it.name} x${it.qty} — ${inr(Number(it.qty) * Number(it.rate))}`)
    .join('\n')
  const balanceLine = Number(inv.balance_due) > 0
    ? `Balance Due: ${inr(inv.balance_due)}\n`
    : `Paid in Full ✓\n`
  return (
    `🏪 ${SHOP.name}\n` +
    `${SHOP.location.split(',')[0]} | ${SHOP.phone}\n\n` +
    `Invoice: #${inv.invoice_number}\n` +
    `Customer: ${inv.customer_name ?? ''}\n\n` +
    `Items:\n${lines}\n\n` +
    `Total: ${inr(inv.total)}\n` +
    `Paid (${inv.payment_method}): ${inr(inv.advance)}\n` +
    balanceLine +
    `\nDelivery: ${longDate(inv.delivery_date)}\n\n` +
    `Thank you! 🙏`
  )
}
