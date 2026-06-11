// Database row types (mirror Supabase schema)

export interface LineItem {
  name: string
  qty: number
  rate: number
  category?: string
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  address: string | null
  created_at: string
  total_orders: number
  lifetime_value: number
  consent: boolean
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  items: LineItem[]
  subtotal: number
  discount: number
  advance: number
  total: number
  balance_due: number
  payment_method: string
  delivery_date: string | null
  trial_date: string | null
  status: string
  notes: string | null
  created_at: string
}

export interface Purchase {
  id: string
  supplier: string
  supplier_phone: string | null
  bill_no: string | null
  date: string
  items: LineItem[]
  total: number
  tax_rate: number
  tax_amount: number
  payment_mode: string
  status: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  created_at: string
}

export interface WhatsappTemplate {
  id: string
  title: string
  body: string
  created_at: string
}

export interface PurchaseReturn {
  id: string
  purchase_id: string | null
  supplier: string | null
  reason: string | null
  items: LineItem[]
  total: number
  date: string
  created_at: string
}

export interface SalesReturn {
  id: string
  invoice_id: string | null
  customer_id: string | null
  customer_name: string | null
  reason: string | null
  refund_method: string | null
  items: LineItem[]
  total: number
  date: string
  created_at: string
}

export interface InventoryItem {
  id: string
  name: string
  sku: string | null
  category: string | null
  in_stock: number
  min_level: number
  buying_rate: number
  selling_rate: number
  barcode: string | null
  online: boolean
  group_name: string | null
  color: string | null
  created_at: string
}

export interface Order {
  id: string
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  items: LineItem[]
  total: number
  status: string
  created_at: string
}

export interface Expense {
  id: string
  category: string
  amount: number
  description: string | null
  date: string
  paid_via: string
  created_at: string
}

export interface Staff {
  id: string
  name: string
  role: string | null
  phone: string | null
  access_level: string
  created_at: string
}

export interface Settings {
  id: number
  shop_name: string
  location: string
  owner: string
  phone: string
  invoice_prefix: string
  invoice_footer: string
  last_invoice_seq: number
  instagram_link: string | null
  facebook_link: string | null
  google_link: string | null
  website_link: string | null
  logo_url: string | null
}
