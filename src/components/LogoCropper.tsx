import { useEffect, useRef, useState, type PointerEvent } from 'react'

/**
 * Lightweight logo crop/zoom tool — no external deps.
 * Drag to reposition, slider to zoom, then exports a square PNG blob.
 */
export default function LogoCropper({ file, onCancel, onSave }: {
  file: File
  onCancel: () => void
  onSave: (blob: Blob) => void
}) {
  const V = 280   // on-screen viewport (square)
  const OUT = 512 // exported size
  const [url, setUrl] = useState('')
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // offset from centre, in screen px
  const imgRef = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const fit = nat.w && nat.h ? Math.min(V / nat.w, V / nat.h) : 1
  const scale = fit * zoom
  const dispW = nat.w * scale
  const dispH = nat.h * scale

  function onDown(e: PointerEvent) {
    drag.current = { sx: e.clientX, sy: e.clientY, cx: pos.x, cy: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onMove(e: PointerEvent) {
    if (!drag.current) return
    setPos({ x: drag.current.cx + (e.clientX - drag.current.sx), y: drag.current.cy + (e.clientY - drag.current.sy) })
  }
  function onUp() { drag.current = null }

  function save() {
    const img = imgRef.current
    if (!img) return
    setBusy(true)
    const k = OUT / V
    const canvas = document.createElement('canvas')
    canvas.width = OUT; canvas.height = OUT
    const ctx = canvas.getContext('2d')!
    const drawW = dispW * k
    const drawH = dispH * k
    const cx = OUT / 2 + pos.x * k
    const cy = OUT / 2 + pos.y * k
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
    canvas.toBlob((blob) => {
      setBusy(false)
      if (blob) onSave(blob)
    }, 'image/png')
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Adjust Logo</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 14 }}>Drag to position · slider to zoom</div>

        <div
          style={{
            width: V, height: V, margin: '0 auto', borderRadius: 16, overflow: 'hidden', position: 'relative',
            background: 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 20px 20px',
            cursor: 'grab', touchAction: 'none', border: '1px solid rgba(0,0,0,0.1)',
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {url && (
            <img
              ref={imgRef}
              src={url}
              alt="logo"
              draggable={false}
              onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={{
                position: 'absolute', left: '50%', top: '50%',
                width: dispW, height: dispH,
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                userSelect: 'none', pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Zoom</span>
          <input type="range" min={1} max={4} step={0.02} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-gold" style={{ flex: 1 }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Logo'}</button>
        </div>
      </div>
    </div>
  )
}
