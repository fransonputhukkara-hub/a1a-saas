import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useShop, ShopLogo } from '../lib/ShopContext'

/**
 * Landing page for the password-reset email link. Supabase establishes a
 * temporary recovery session when the link is opened; we then let the user
 * set a new password via updateUser().
 */
export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const { shop } = useShop()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // The recovery link sets a session; confirm we have one.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY' || s) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null)
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) return setError(error)
    setInfo('Password updated! Redirecting to sign in…')
    setTimeout(async () => {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    }, 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="glass-card w-full max-w-md p-8 sm:p-10 relative">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center"><ShopLogo size={64} /></div>
          <h1 className="font-serif text-2xl" style={{ color: 'var(--ink)' }}>{shop.name}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Set a New Password</p>
        </div>

        {!ready ? (
          <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
            Open this page from the reset link in your email. If you got here by mistake,{' '}
            <button className="font-semibold underline" style={{ color: 'var(--navy)' }} onClick={() => navigate('/login')}>go to sign in</button>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoFocus
                  autoComplete="new-password"
                  className="glass-input pr-16"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--red-l)', color: 'var(--red)' }}>{error}</div>}
            {info && <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--green-l)', color: 'var(--green)' }}>{info}</div>}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
