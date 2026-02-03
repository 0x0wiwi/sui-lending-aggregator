import { cn } from "@/lib/utils"

export function formatApr(value: number) {
  return Number.isFinite(value) ? `${value.toFixed(3)}%` : "—"
}

export function renderAlignedPercent(value: number, className?: string) {
  if (!Number.isFinite(value)) return <span className={className}>—</span>
  const formatted = value.toFixed(3)
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
