import { useEffect, type ReactNode } from 'react'

export interface SuccessDetail {
  label: string
  value: string
}

/**
 * Premium "success" celebration modal — animated checkmark, confetti burst,
 * details card and a floating document icon. Reused by Sale, Purchase and
 * Sales Return so every save gives clear, delightful confirmation.
 */
export default function SuccessModal({
  title,
  subtitle,
  details,
  actions,
  onClose,
}: {
  title: string
  subtitle: string
  details: SuccessDetail[]
  actions?: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const confettiColors = ['#c9a84c', '#1a5e3a', '#6b1a1a', '#e8b84b', '#1a4a8a', '#25d366']

  return (
    <div className="success-overlay" onClick={onClose}>
      <div className="success-modal" onClick={(e) => e.stopPropagation()}>
        {/* Confetti burst */}
        <div className="confetti-wrap" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                background: confettiColors[i % confettiColors.length],
                left: '50%',
                top: '64px',
                ['--dx' as string]: `${Math.round((Math.random() - 0.5) * 360)}px`,
                ['--dy' as string]: `${Math.round(-40 - Math.random() * 220)}px`,
                ['--rot' as string]: `${Math.round(Math.random() * 720 - 360)}deg`,
                animationDelay: `${Math.random() * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Animated checkmark */}
        <div className="success-check">
          <svg viewBox="0 0 52 52">
            <circle className="success-check-circle" cx="26" cy="26" r="24" fill="none" />
            <path className="success-check-mark" fill="none" d="M14 27l8 8 16-18" />
          </svg>
        </div>

        <h2 className="success-title">{title}</h2>
        <p className="success-sub">{subtitle}</p>

        <div className="success-details">
          {details.map((d) => (
            <div key={d.label} className="success-detail-row">
              <span>{d.label}</span>
              <strong>{d.value}</strong>
            </div>
          ))}
        </div>

        {actions && <div className="success-actions">{actions}</div>}

        {/* Floating document icon */}
        <div className="success-doc" aria-hidden="true">🧾</div>
      </div>
    </div>
  )
}
