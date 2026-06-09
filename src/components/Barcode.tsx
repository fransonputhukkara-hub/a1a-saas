import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface Props {
  value: string
  width?: number
  height?: number
  fontSize?: number
  displayValue?: boolean
  /** Use 'CODE128' (default — alphanumeric, robust) or 'EAN13' for product retail barcodes. */
  format?: string
}

export function Barcode({
  value,
  width = 1.6,
  height = 50,
  fontSize = 12,
  displayValue = true,
  format = 'CODE128',
}: Props) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format,
        width,
        height,
        displayValue,
        fontSize,
        background: '#ffffff',
        lineColor: '#1a1a2e',
        margin: 4,
      })
    } catch {
      // Invalid format/value — leave the svg blank rather than throwing.
    }
  }, [value, width, height, fontSize, displayValue, format])

  return <svg ref={ref} />
}

/** Generate a fresh, reasonably-unique CODE128 string for new inventory items. */
export function generateBarcode(prefix = 'ST'): string {
  const num = Math.floor(Math.random() * 10_000_000)
    .toString()
    .padStart(7, '0')
  return `${prefix}${num}`
}
