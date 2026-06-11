import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react'

/* ── Card ── */
export function Card({
  children,
  className = '',
  title,
  sticky,
  actions,
}: {
  children: ReactNode
  className?: string
  title?: string
  sticky?: boolean
  actions?: ReactNode
}) {
  return (
    <div
      className={`glass-card card ${className}`}
      style={sticky ? { position: 'sticky', top: 76 } : undefined}
    >
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {title && <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>}
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

/* ── Page header ── */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string
  sub?: string
  actions?: ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">{title}</div>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

/* ── Pill ── */
type PillTone = 'green' | 'gold' | 'red' | 'blue' | 'purple' | 'orange' | 'teal' | 'gray'
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`pill p-${tone}`}>{children}</span>
}

/* ── Stat card ── */
type Accent = 'green' | 'gold' | 'blue' | 'red' | 'purple' | 'orange' | 'teal'
export function StatCard({
  accent,
  icon,
  value,
  label,
  change,
  changeDir,
}: {
  accent: Accent
  icon: ReactNode
  value: string
  label: string
  change?: string
  changeDir?: 'up' | 'down'
}) {
  return (
    <div className={`glass-card stat-card sc-${accent}`}>
      <div className={`stat-icon si-${accent}`}>{icon}</div>
      <div>
        <div className="stat-val">{value}</div>
        <div className="stat-label">{label}</div>
        {change && <div className={`stat-change ${changeDir ?? 'up'}`}>{change}</div>}
      </div>
    </div>
  )
}

/* ── KPI tile ── */
export function Kpi({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-val" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="kpi-key">{label}</div>
    </div>
  )
}

/* ── Inputs ── */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`glass-input ${props.className ?? ''}`} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`glass-input ${props.className ?? ''}`} />
}
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

/* ── Toggle ── */
export function Toggle({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : 'off'}`}
      onClick={() => onChange?.(!on)}
      aria-pressed={on}
    />
  )
}
export function ToggleRow({
  label,
  sub,
  on,
  onChange,
}: {
  label: string
  sub?: string
  on: boolean
  onChange?: (v: boolean) => void
}) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

/* ── Bar chart ── */
export function BarChart({
  rows,
}: {
  rows: { label: string; pct: number; amount?: string; color: string; right?: string }[]
}) {
  return (
    <div className="bar-chart">
      {rows.map((r, i) => (
        <div className="bar-row" key={i}>
          <div className="bar-label">{r.label}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${Math.max(2, Math.min(100, r.pct))}%`, background: r.color }}
            >
              {r.amount}
            </div>
          </div>
          {r.right !== undefined && <div className="bar-amt">{r.right}</div>}
        </div>
      ))}
    </div>
  )
}

/* ── Empty / loading states ── */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--muted)', fontSize: '0.82rem' }}>
      {children}
    </div>
  )
}
export function Loading() {
  return <Empty>Loading…</Empty>
}
