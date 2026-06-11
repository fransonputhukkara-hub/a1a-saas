import { supabase } from './supabase'
import type { InventoryItem, LineItem } from './types'

/**
 * Adjust inventory stock for a set of line items.
 * sign = +1 for purchases (stock in), -1 for sales/returns out.
 * Matches items to inventory rows by (case-insensitive) name. If a purchased
 * item doesn't exist yet, it is created so stock starts tracking immediately.
 */
export async function adjustStock(items: LineItem[], sign: 1 | -1) {
  const { data } = await supabase.from('inventory').select('*')
  const stock = (data as InventoryItem[]) ?? []

  for (const it of items) {
    const name = it.name.trim()
    if (!name) continue
    const qty = Number(it.qty || 0)
    if (qty === 0) continue

    const match = stock.find((s) => s.name.toLowerCase() === name.toLowerCase())
    if (match) {
      const next = Number(match.in_stock) + sign * qty
      await supabase
        .from('inventory')
        .update({ in_stock: Math.max(0, next) })
        .eq('id', match.id)
    } else if (sign === 1) {
      // New item discovered via a purchase — start tracking it.
      await supabase.from('inventory').insert({
        name,
        category: it.category?.trim() || 'Uncategorised',
        in_stock: qty,
        buying_rate: Number(it.rate || 0),
        selling_rate: Math.round(Number(it.rate || 0) * 1.5),
        online: false, // new purchase items aren't shown online until reviewed (need a photo)
      })
    }
  }
}
