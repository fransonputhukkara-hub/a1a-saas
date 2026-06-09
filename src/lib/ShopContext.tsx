import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, SHOP } from './supabase'

export interface ShopInfo {
  name: string
  location: string
  phone: string
  owner: string
  footer: string
  instagram_link: string | null
  facebook_link: string | null
  google_link: string | null
  website_link: string | null
  logo_url: string | null
}

const defaults: ShopInfo = {
  name: SHOP.name,
  location: SHOP.location,
  phone: SHOP.phone,
  owner: SHOP.owner,
  footer: 'Thank you! Visit again 🙏',
  instagram_link: null,
  facebook_link: null,
  google_link: null,
  website_link: null,
  logo_url: null,
}

const ShopContext = createContext<{ shop: ShopInfo; refresh: () => void }>({
  shop: defaults,
  refresh: () => {},
})

export function ShopProvider({ children }: { children: ReactNode }) {
  const [shop, setShop] = useState<ShopInfo>(defaults)

  function refresh() {
    // Public function — works whether the visitor is logged in or not
    // (used by the dashboard, the bill and the public invoice page).
    supabase.rpc('get_public_shop').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return
      setShop({
        name: row.shop_name ?? defaults.name,
        location: row.location ?? defaults.location,
        phone: row.phone ?? defaults.phone,
        owner: row.owner ?? defaults.owner,
        footer: row.invoice_footer ?? defaults.footer,
        instagram_link: row.instagram_link ?? null,
        facebook_link: row.facebook_link ?? null,
        google_link: row.google_link ?? null,
        website_link: row.website_link ?? null,
        logo_url: row.logo_url ?? null,
      })
    })
  }

  useEffect(() => {
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh())
    return () => sub.subscription.unsubscribe()
  }, [])

  return <ShopContext.Provider value={{ shop, refresh }}>{children}</ShopContext.Provider>
}

export const useShop = () => useContext(ShopContext)

/** Shop logo image if uploaded, otherwise initials in a branded tile. */
export function ShopLogo({ size = 64, radius = 16 }: { size?: number; radius?: number }) {
  const { shop } = useShop()
  if (shop.logo_url) {
    return (
      <img
        src={shop.logo_url}
        alt={shop.name}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', background: '#fff' }}
      />
    )
  }
  const initials = shop.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'SH'
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: 'var(--navy, #1a1a2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold, #c9a84c)', fontFamily: "'Playfair Display', serif", fontSize: size * 0.34, fontWeight: 700 }}>
      {initials}
    </div>
  )
}
