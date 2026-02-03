import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type RewardSummarySwapControlsProps = {
  showClaimActions: boolean
  swapTargetOptions: Array<{ label: string; coinType: string }>
  selectedTargetLabel: string
  slippageLabel: string
  swapEnabled: boolean
  onSwapEnabledChange: (enabled: boolean) => void
  onSwapTargetChange: (coinType: string) => void
}

export function RewardSummarySwapControls({
  showClaimActions,
  swapTargetOptions,
  selectedTargetLabel,
  slippageLabel,
  swapEnabled,
  onSwapEnabledChange,
  onSwapTargetChange,
}: RewardSummarySwapControlsProps) {
  if (!showClaimActions) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Swap to</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {selectedTargetLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {swapTargetOptions.map((option) => (
            <DropdownMenuItem
              key={option.coinType}
              onClick={() => onSwapTargetChange(option.coinType)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span>Slippage {slippageLabel}</span>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-3 w-3 accent-foreground"
          checked={swapEnabled}
          onChange={(event) => onSwapEnabledChange(event.target.checked)}
        />
        Auto swap
      </label>
    </div>
  )
}
