import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Protocol, RewardSummaryItem } from "@/lib/market-data"
import { formatAmount } from "@/components/reward-summary/formatters"

type SwapPreviewItem = {
  token: string
  amount: number
  coinType?: string
  steps: Array<{ from: string; target: string; provider: string }>
  estimatedOut?: string
  note?: string
}

type SwapPreview = {
  items: SwapPreviewItem[]
  targetSymbol: string
  canSwapAll: boolean
}

type SwapPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  onContinue: () => void
  swapPreview: SwapPreview | null
  swapPreviewLoading: boolean
  coinDecimalsMap: Record<string, number>
  confirmTarget: { protocol: Protocol | "all"; rewards: RewardSummaryItem["rewards"] } | null
}

export function SwapPreviewDialog({
  open,
  onOpenChange,
  onCancel,
  onContinue,
  swapPreview,
  swapPreviewLoading,
  coinDecimalsMap,
  confirmTarget,
}: SwapPreviewDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Swap preview</AlertDialogTitle>
          <AlertDialogDescription>
            Review the swap results before continuing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2 text-xs">
          {swapPreviewLoading ? (
            <div>Loading routes...</div>
          ) : swapPreview?.items.length ? (
            <div className="grid gap-3">
              {swapPreview.items.map((item) => (
                <div key={item.token} className="grid gap-1 rounded-md border p-2">
                  <div className="flex items-center justify-between font-medium">
                    <span>{item.token}</span>
                    <span>
                      {formatAmount(
                        item.amount,
                        item.coinType ? coinDecimalsMap[item.coinType] : undefined
                      )}
                    </span>
                  </div>
                  {item.note ? (
                    <div className="text-muted-foreground">{item.note}</div>
                  ) : null}
                  <div className="text-muted-foreground">
                    Estimated {swapPreview.targetSymbol}{" "}
                    {item.estimatedOut ?? "—"}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-xs font-semibold">
                <span>Total</span>
                <span>
                  {swapPreview.items.length
                    ? swapPreview.items
                        .map((item) =>
                          item.estimatedOut
                            ? Number(item.estimatedOut.replace(/,/g, ""))
                            : 0
                        )
                        .reduce((sum, value) => sum + value, 0)
                        .toLocaleString("en-US", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 12,
                        })
                    : "—"}{" "}
                  {swapPreview.items.length ? swapPreview.targetSymbol : ""}
                </span>
              </div>
              {!swapPreview.canSwapAll && (
                <div className="text-xs text-destructive">
                  Some rewards cannot be swapped.
                </div>
              )}
            </div>
          ) : (
            <div>No swappable rewards.</div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onContinue}
            disabled={
              !confirmTarget
              || swapPreviewLoading
              || !swapPreview?.canSwapAll
              || !swapPreview?.items.length
            }
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
