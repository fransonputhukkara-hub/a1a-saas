import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { supabaseConfigError } from './lib/supabase'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sale from './pages/Sale'
import Customers from './pages/Customers'
import Purchase from './pages/Purchase'
import PurchaseReturn from './pages/PurchaseReturn'
import SalesReturn from './pages/SalesReturn'
import Inventory from './pages/Inventory'
import ProductFlow from './pages/ProductFlow'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import WhatsApp from './pages/WhatsApp'
import Settings from './pages/Settings'

function ConfigNeeded({ message }: { message: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="glass-card" style={{ maxWidth: 600, padding: 32 }}>
        <h1 className="font-serif" style={{ fontSize: '1.4rem', color: 'var(--ink)', marginBottom: 8 }}>
          Setup needed
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 16 }}>{message}</p>
        <pre style={{ background: 'rgba(0,0,0,0.05)', padding: 14, borderRadius: 12, fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
{`# .env  (in the project root)
VITE_SUPABASE_URL=https://abwqcxdoimfnzmtcccjz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_vdY4zAft5kLLma8wlEGhRA_BttpiX-p`}
        </pre>
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 12 }}>
          Then stop and restart <code>npm run dev</code> (Vite only reads .env at startup).
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (supabaseConfigError) {
    return (
      <ErrorBoundary>
        <ConfigNeeded message={supabaseConfigError} />
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/sale" element={<Sale />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/purchase-return" element={<PurchaseReturn />} />
            <Route path="/sales-return" element={<SalesReturn />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/product-flow" element={<ProductFlow />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  )
}
