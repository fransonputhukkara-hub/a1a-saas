import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { SHOP } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      {/* soft decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 -left-24 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.16), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(26,74,138,0.14), transparent 70%)' }}
      />

      <div className="glass-card w-full max-w-md p-8 sm:p-10 relative">
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'var(--navy)', boxShadow: '0 8px 24px rgba(26,26,46,0.3)' }}
          >
            <span className="font-serif text-2xl" style={{ color: 'var(--gold)' }}>
              St
            </span>
          </div>
          <h1 className="font-serif text-2xl" style={{ color: 'var(--ink)' }}>
            {SHOP.name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {SHOP.location} · Business Suite
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--muted)' }}
            >
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              className="glass-input"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--muted)' }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="glass-input pr-16"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                style={{ color: 'var(--muted)' }}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-2.5 text-sm"
              style={{ background: 'var(--red-l)', color: 'var(--red)' }}
            >
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--muted)' }}>
          Owner access only · {SHOP.phone}
        </p>
      </div>
    </div>
  )
}
