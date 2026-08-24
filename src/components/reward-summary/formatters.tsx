import { formatTokenAmount } from "@/lib/format-number"

export function renderAlignedNumber(value: number) {
  const formatted = formatTokenAmount(value)
  if (formatted === "—") return formatted
  const [whole, fraction] = formatted.split(".")
  return (
    <span className="inline-flex items-baseline tabular-nums">
      <span className="min-w-[10ch] text-right">{whole}</span>
      <span className="min-w-[6ch] text-left text-xs text-muted-foreground">
        .{fraction}
      </span>
    </span>
  )
}
