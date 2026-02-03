import BigNumber from "bignumber.js"

export function formatAmount(value: number, decimals?: number) {
  if (typeof decimals !== "number" || !Number.isFinite(decimals)) {
    return "—"
  }
  const maxDigits = Math.max(decimals, 0)
  const fixed = new BigNumber(value).toFixed(maxDigits, BigNumber.ROUND_FLOOR)
  const [whole, fractionRaw] = fixed.split(".")
  const fraction = fractionRaw ? fractionRaw.replace(/0+$/, "") : ""
  const wholeFormatted = Number(whole).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })
  return fraction ? `${wholeFormatted}.${fraction}` : wholeFormatted
}

export function renderAlignedNumber(value: number, decimals?: number) {
  const formatted = formatAmount(value, decimals)
  const [whole, fraction] = formatted.split(".")
  return (
    <span className="inline-flex items-baseline tabular-nums">
      <span className="min-w-[6ch] text-right">{whole}</span>
      <span className="min-w-[1ch] text-left text-xs text-muted-foreground">
        {fraction ? `.${fraction}` : ""}
      </span>
    </span>
  )
}
