import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useShop, ShopLogo } from '../lib/ShopContext'

type Mode = 'signin' | 'signup' | 'forgot'

export default function Login() {
  const { signIn, signUp, sendReset } = useAuth()
  const { shop } = useShop()
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
    <div className="login-landing">
      {/* ── Hero panel — Kerala saree shop ── */}
      <div className="login-hero">
        <div className="kasavu-border" />
        <div className="login-hero-body">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.name} style={{ height: 96, width: 'auto', maxWidth: '90%', objectFit: 'contain', marginBottom: 8 }} />
          ) : (
            <>
              <div className="login-hero-logo"><ShopLogo size={92} radius={20} /></div>
              <h1 className="login-hero-name">{shop.name}</h1>
            </>
          )}
          <div className="login-hero-sub">Handloom · Pure Silks · Heritage Weaves of Kerala</div>
          <div className="login-hero-orn">✦ ❖ ✦</div>
          <p className="login-hero-quote">
            “Every saree tells a story — woven with tradition, draped in grace.”
          </p>
          <div className="login-hero-tags">
            <span>Kanjivaram</span><span>Kasavu</span><span>Soft Silk</span><span>Bridal</span>
          </div>
        </div>
        <div className="kasavu-border" />
      </div>

      {/* ── Form panel ── */}
      <div className="login-form-panel">
        <div className="login-form-inner">
          <div className="login-form-brand">
            <ShopLogo size={46} radius={12} />
            <div>
              <div className="login-form-shop">{shop.name}</div>
              <div className="login-form-suite">Business Suite</div>
            </div>
          </div>

          <h2 className="login-form-title">{titles[mode]}</h2>
          <p className="login-form-hint">
            {mode === 'signin' ? 'Welcome back — sign in to manage your store.' : mode === 'signup' ? 'Create your owner account.' : 'We’ll email you a reset link.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="login-label">Email</label>
              <input type="email" required autoFocus autoComplete="username" className="glass-input" placeholder="owner@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="login-label">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="glass-input pr-16" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--red-l)', color: 'var(--red)' }}>{error}</div>}
            {info && <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--green-l)', color: 'var(--green)' }}>{info}</div>}

            <button type="submit" className="btn login-submit w-full" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs space-y-2" style={{ color: 'var(--muted)' }}>
            {mode === 'signin' && (
              <>
                <div><button type="button" className="login-link" onClick={() => switchMode('forgot')}>Forgot password?</button></div>
                <div>No account?{' '}<button type="button" className="login-link" onClick={() => switchMode('signup')}>Create one</button></div>
              </>
            )}
            {mode === 'signup' && (
              <div>Already have an account?{' '}<button type="button" className="login-link" onClick={() => switchMode('signin')}>Sign in</button></div>
            )}
            {mode === 'forgot' && (
              <div><button type="button" className="login-link" onClick={() => switchMode('signin')}>← Back to sign in</button></div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
