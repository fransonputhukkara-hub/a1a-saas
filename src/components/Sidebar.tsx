import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SHOP } from '../lib/supabase'

const I = (children: ReactNode) => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    {children}
  </svg>
)

interface NavDef {
  to: string
  label: string
  icon: ReactNode
  badge?: string
}

const SECTIONS: { heading: string; items: NavDef[] }[] = [
  {
    heading: 'Overview',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        icon: I(
          <>
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </>
        ),
      },
    ],
  },
  {
    heading: 'Transactions',
    items: [
      { to: '/purchase', label: 'Purchase', icon: I(<><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></>) },
      { to: '/purchase-return', label: 'Purchase Return', icon: I(<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></>) },
      { to: '/sale', label: 'Sale / Invoice', badge: '+', icon: I(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></>) },
      { to: '/sales-return', label: 'Sales Return', icon: I(<><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></>) },
    ],
  },
  {
    heading: 'Inventory',
    items: [
      { to: '/inventory', label: 'Inventory', icon: I(<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />) },
      { to: '/product-flow', label: 'Product Flow', icon: I(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />) },
    ],
  },
  {
    heading: 'People',
    items: [
      { to: '/customers', label: 'Customers', icon: I(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>) },
      { to: '/payroll', label: 'Payroll', icon: I(<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></>) },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { to: '/expenses', label: 'Expenses', icon: I(<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></>) },
      { to: '/reports', label: 'Reports', icon: I(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>) },
    ],
  },
  {
    heading: 'Grow',
    items: [
      {
        to: '/whatsapp',
        label: 'WhatsApp',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
          </svg>
        ),
      },
      { to: '/settings', label: 'Settings', icon: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>) },
    ],
  },
]

export default function Sidebar({ open, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  return (
    <aside className={`sidebar glass-sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-text">
          St. <span>Thomas</span>
        </div>
        <div className="logo-sub">Men's Wear · Business Suite</div>
      </div>
      <nav className="sidebar-nav">
        {SECTIONS.map((sec) => (
          <div key={sec.heading}>
            <div className="nav-section-label">{sec.heading}</div>
            {sec.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onNavigate}
              >
                {it.icon}
                {it.label}
                {it.badge && <span className="nav-badge">{it.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <strong>{SHOP.name}</strong>
        {SHOP.location}
      </div>
    </aside>
  )
}
