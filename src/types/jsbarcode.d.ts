declare module 'jsbarcode' {
  interface Options {
    format?: string
    width?: number
    height?: number
    displayValue?: boolean
    fontSize?: number
    margin?: number
    background?: string
    lineColor?: string
    text?: string
    textAlign?: string
    textMargin?: number
  }
  function JsBarcode(element: HTMLElement | SVGElement | string, value: string, options?: Options): void
  export default JsBarcode
}
