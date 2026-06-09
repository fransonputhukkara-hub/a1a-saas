import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { SHOP } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'forgot'

export default function Login() {
  const { signIn, signUp, sendReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password)
      setLoading(false)
      if (error) return setError(error)
      navigate(from, { replace: true })
    } else if (mode === 'signup') {
      if (password.length < 6) { setLoading(false); return setError('Password must be at least 6 characters.') }
      const { error, needsConfirm } = await signUp(email.trim(), password)
      setLoading(false)
      if (error) return setError(error)
      if (needsConfirm) {
        setInfo('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
      } else {
        navigate(from, { replace: true })
      }
    } else {
      const { error } = await sendReset(email.trim())
      setLoading(false)
      if (error) return setError(error)
      setInfo('Password reset link sent! Check your email.')
    }
  }

  const titles: Record<Mode, string> = {
    signin: 'Sign In',
    signup: 'Create Account',
    forgot: 'Reset Password',
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
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
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'var(--navy)', boxShadow: '0 8px 24px rgba(26,26,46,0.3)' }}
          >
            <span className="font-serif text-2xl" style={{ color: 'var(--gold)' }}>St</span>
          </div>
          <h1 className="font-serif text-2xl" style={{ color: 'var(--ink)' }}>{SHOP.name}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{titles[mode]} · Business Suite</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Email</label>
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

          {mode !== 'forgot' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
          )}

          {error && (
            <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--red-l)', color: 'var(--red)' }}>{error}</div>
          )}
          {info && (
            <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--green-l)', color: 'var(--green)' }}>{info}</div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs space-y-2" style={{ color: 'var(--muted)' }}>
          {mode === 'signin' && (
            <>
              <div>
                <button type="button" className="font-semibold underline" style={{ color: 'var(--navy)' }} onClick={() => switchMode('forgot')}>Forgot password?</button>
              </div>
              <div>
                No account?{' '}
                <button type="button" className="font-semibold underline" style={{ color: 'var(--navy)' }} onClick={() => switchMode('signup')}>Create one</button>
              </div>
            </>
          )}
          {mode === 'signup' && (
            <div>
              Already have an account?{' '}
              <button type="button" className="font-semibold underline" style={{ color: 'var(--navy)' }} onClick={() => switchMode('signin')}>Sign in</button>
            </div>
          )}
          {mode === 'forgot' && (
            <div>
              <button type="button" className="font-semibold underline" style={{ color: 'var(--navy)' }} onClick={() => switchMode('signin')}>← Back to sign in</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
