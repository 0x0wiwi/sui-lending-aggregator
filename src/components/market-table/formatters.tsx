import { cn } from "@/lib/utils"
import { formatFloorFixed, RATE_DECIMAL_PLACES } from "@/lib/format-number"

export function formatApr(value: number) {
  const formatted = formatFloorFixed(value, RATE_DECIMAL_PLACES)
  return formatted ? `${formatted}%` : "—"
}

export function renderAlignedPercent(value: number, className?: string) {
  const formatted = formatFloorFixed(value, RATE_DECIMAL_PLACES)
  if (!formatted) return <span className={className}>—</span>
  const [whole, fraction] = formatted.split(".")
  const toneClass = className?.includes("text-rose")
    ? "text-rose-500/70 dark:text-rose-400/70"
    : className?.includes("text-emerald")
      ? "text-emerald-500/70 dark:text-emerald-400/70"
      : "text-muted-foreground"
  const fractionClass = cn("text-xs", toneClass)
  return (
    <span className={cn("inline-flex items-baseline tabular-nums", className)}>
      <span className="min-w-[4ch] text-right">{whole}</span>
      <span className={cn("min-w-[1ch] text-left", fractionClass)}>
        {fraction ? `.${fraction}` : ""}
      </span>
      <span className={cn("ml-1 text-xs", fractionClass)}>%</span>
    </span>
  )
}
