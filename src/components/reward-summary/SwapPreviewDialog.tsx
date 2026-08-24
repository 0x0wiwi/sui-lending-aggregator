import BigNumber from "bignumber.js"
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
import type { Protocol } from "@/lib/market-data"
import { formatTokenAmount } from "@/lib/format-number"
import { getSwapPreviewView } from "@/lib/swap-preview-state"

type SwapPreviewItem = {
  token: string
  amount: number
  coinType?: string
  steps: Array<{ from: string; target: string; provider: string }>
  estimatedOut?: string
  exchangeRate?: string
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
  confirmTarget: Protocol | "all" | null
}

export function SwapPreviewDialog({
  open,
  onOpenChange,
  onCancel,
  onContinue,
  swapPreview,
  swapPreviewLoading,
  confirmTarget,
}: SwapPreviewDialogProps) {
  const view = getSwapPreviewView(
    Boolean(swapPreview?.items.length),
    swapPreviewLoading
  )

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
          {view === "preview" && swapPreview ? (
            <div className="grid gap-3">
              {swapPreview.items.map((item) => (
                <div key={item.token} className="grid gap-1 rounded-md border p-2">
                  <div className="flex items-center justify-between font-medium">
                    <span>{item.token}</span>
                    <span>
                      {formatTokenAmount(item.amount)}
                    </span>
                  </div>
                  {item.note ? (
                    <div className="text-muted-foreground">{item.note}</div>
                  ) : null}
                  <div className="text-muted-foreground">
                    Estimated {swapPreview.targetSymbol}{" "}
                    {item.estimatedOut
                      ? formatTokenAmount(item.estimatedOut.replace(/,/g, ""))
                      : "—"}
                  </div>
                  {item.exchangeRate ? (
                    <div className="text-muted-foreground">
                      Rate {item.exchangeRate} {item.token} /{" "}
                      {swapPreview.targetSymbol}
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-xs font-semibold">
                <span>Total</span>
                <span>
                  {swapPreview.items.length
                    ? formatTokenAmount(
                        swapPreview.items.reduce(
                          (sum, item) => item.estimatedOut
                            ? sum.plus(item.estimatedOut.replace(/,/g, ""))
                            : sum,
                          new BigNumber(0)
                        )
                      )
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
          ) : view === "loading" ? (
            <div>Loading routes...</div>
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
