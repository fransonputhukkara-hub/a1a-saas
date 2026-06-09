import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../lib/AuthContext'
import { useShop } from '../lib/ShopContext'

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Dashboard', sub: '' },
  '/purchase': { title: 'Purchase Entry', sub: 'Record supplier purchases' },
  '/purchase-return': { title: 'Purchase Return', sub: 'Return to suppliers' },
  '/sale': { title: 'New Sale / Invoice', sub: 'Create a bill' },
  '/sales-return': { title: 'Sales Return', sub: 'Process customer returns' },
  '/inventory': { title: 'Inventory', sub: 'Stock levels' },
  '/product-flow': { title: 'Product Flow Analysis', sub: 'Stock movement insights' },
  '/customers': { title: 'Customers', sub: 'Customer directory' },
  '/expenses': { title: 'Expenses', sub: 'Operating costs' },
  '/payroll': { title: 'Payroll', sub: 'Staff salaries & attendance' },
  '/reports': { title: 'Reports & Analytics', sub: 'Business performance' },
  '/whatsapp': { title: 'WhatsApp Remarketing', sub: 'Campaigns & win-back' },
  '/settings': { title: 'Settings', sub: 'Shop configuration' },
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { signOut } = useAuth()
  const { shop } = useShop()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const meta = PAGE_META[pathname] ?? { title: '', sub: '' }
  if (pathname === '/') meta.sub = `Good day, ${shop.owner} 👋`

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
      />
      <Sidebar open={open} onNavigate={() => setOpen(false)} />

      <div className="main-area">
        <div className="topbar glass-topbar">
          <button className="hamburger" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="font-serif" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}>
              {meta.title}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: 8 }}>
              / {meta.sub}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-gold no-print" onClick={() => navigate('/sale')}>
              ＋ New Bill
            </button>
            <div className="avatar">TC</div>
            <button className="btn btn-outline no-print" onClick={() => signOut()}>
              Sign Out
            </button>
          </div>
        </div>

        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
