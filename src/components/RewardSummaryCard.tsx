import * as React from "react"
import BigNumber from "bignumber.js"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { assetTypeAddresses, type Protocol } from "@/lib/market-data"
import type { RewardSummaryItem } from "@/lib/market-data"

type RewardSummaryCardProps = {
  displayAddress?: string | null
  summaryRows: RewardSummaryItem[]
  totalSupplyList: { asset: string; amount: number }[]
  totalRewardList: RewardSummaryItem["rewards"]
  showClaimActions: boolean
  claimError: string | null
  claimingProtocol: Protocol | "all" | null
  hasAnyClaim: boolean
  coinDecimalsMap: Record<string, number>
  onClaimProtocol: (protocol: Protocol) => void
  onClaimAll: () => void
  isProtocolClaimSupported: (protocol: Protocol) => boolean
  swapTargetCoinType: string
  swapTargetOptions: Array<{ label: string; coinType: string }>
  onSwapTargetChange: (coinType: string) => void
  slippageLabel: string
  swapEnabled: boolean
  onSwapEnabledChange: (enabled: boolean) => void
  swapAvailable: boolean
  onRequestSwapPreview: (
    protocol: Protocol | "all",
    rewards: RewardSummaryItem["rewards"]
  ) => Promise<
    | {
        items: Array<{
          token: string
          amount: number
          coinType?: string
          steps: Array<{ from: string; target: string; provider: string }>
          estimatedOut?: string
          note?: string
        }>
        targetSymbol: string
        canSwapAll: boolean
      }
    | null
  >
  swapPreviewLoading: boolean
}

function formatAmount(value: number, decimals?: number) {
  const maxDigits =
    typeof decimals === "number" && Number.isFinite(decimals)
      ? Math.max(decimals, 0)
      : 12
  const fixed = new BigNumber(value).toFixed(maxDigits, BigNumber.ROUND_FLOOR)
  const [whole, fractionRaw] = fixed.split(".")
  const fraction = fractionRaw ? fractionRaw.replace(/0+$/, "") : ""
  const wholeFormatted = Number(whole).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })
  return fraction ? `${wholeFormatted}.${fraction}` : wholeFormatted
}

function renderAlignedNumber(value: number, decimals?: number) {
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

function renderSupplyList(
  supplies: { asset: string; amount: number }[],
  decimalsMap: Record<string, number>
) {
  if (!supplies.length) return "—"
  return (
    <div className="grid gap-1">
      {supplies.map((item) => (
        <div key={item.asset} className="grid grid-cols-[5ch_1fr] items-baseline gap-3">
          <span className="font-medium">{item.asset}</span>
          <span>
            {renderAlignedNumber(
              item.amount,
              decimalsMap[
                assetTypeAddresses[item.asset as keyof typeof assetTypeAddresses]
              ] ?? 12
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function renderRewardList(
  rewards: RewardSummaryItem["rewards"],
  decimalsMap: Record<string, number>
) {
  if (!rewards.length) return "—"
  return (
    <div className="grid gap-1">
      {rewards.map((item) => (
        <div
          key={`${item.token}-${item.coinType ?? "unknown"}`}
          className="grid grid-cols-[5ch_1fr] items-baseline gap-3"
        >
          <span className="font-medium">{item.token}</span>
          <span>
            {renderAlignedNumber(
              item.amount,
              item.coinType ? decimalsMap[item.coinType] : 12
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function hasClaimableRewards(
  rewards: RewardSummaryItem["rewards"],
  decimalsMap: Record<string, number>
) {
  return rewards.some((reward) => {
    if (!reward.coinType) return false
    const decimals = decimalsMap[reward.coinType]
    if (decimals === undefined) return false
    const atomic = new BigNumber(reward.amount)
      .shiftedBy(decimals)
      .integerValue(BigNumber.ROUND_FLOOR)
    return atomic.gt(0)
  })
}

export function RewardSummaryCard({
  displayAddress,
  summaryRows,
  totalSupplyList,
  totalRewardList,
  showClaimActions,
  claimError,
  claimingProtocol,
  hasAnyClaim,
  coinDecimalsMap,
  onClaimProtocol,
  onClaimAll,
  isProtocolClaimSupported,
  swapTargetCoinType,
  swapTargetOptions,
  onSwapTargetChange,
  slippageLabel,
  swapEnabled,
  onSwapEnabledChange,
  swapAvailable,
  onRequestSwapPreview,
  swapPreviewLoading,
}: RewardSummaryCardProps) {
  const hasSummaryData = summaryRows.some(
    (item) => item.supplies.length > 0 || item.rewards.length > 0
  )
  const selectedTarget =
    swapTargetOptions.find((option) => option.coinType === swapTargetCoinType)
      ?.label ?? "Select"
  const [confirmTarget, setConfirmTarget] = React.useState<{
    protocol: Protocol | "all"
    rewards: { token: string; amount: number }[]
    title: string
  } | null>(null)
  const [swapPreview, setSwapPreview] = React.useState<{
    items: Array<{
      token: string
      amount: number
      coinType?: string
      steps: Array<{ from: string; target: string; provider: string }>
      estimatedOut?: string
      note?: string
    }>
    targetSymbol: string
    canSwapAll: boolean
  } | null>(null)
  const actionButtonClass = swapEnabled
    ? "w-full min-w-0 justify-center"
    : "w-[96px] min-w-0 justify-center"
  const swapDisabled = swapEnabled && !swapAvailable
  const totalHasClaimableRewards = hasClaimableRewards(
    totalRewardList,
    coinDecimalsMap
  )

  const handleClaim = async (
    protocol: Protocol,
    rewards: RewardSummaryItem["rewards"]
  ) => {
    if (swapEnabled && swapAvailable) {
      setConfirmTarget({
        protocol,
        rewards,
        title: protocol,
      })
      setSwapPreview(null)
      const preview = await onRequestSwapPreview(protocol, rewards)
      setSwapPreview(preview)
      return
    }
    onClaimProtocol(protocol)
  }

  const handleClaimAll = async () => {
    if (swapEnabled && swapAvailable) {
      setConfirmTarget({
        protocol: "all",
        rewards: totalRewardList,
        title: "Total",
      })
      setSwapPreview(null)
      const preview = await onRequestSwapPreview("all", totalRewardList)
      setSwapPreview(preview)
      return
    }
    onClaimAll()
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-muted-foreground uppercase">
          Reward Summary
        </div>
        {showClaimActions ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>Swap to</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {selectedTarget}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
        ) : null}
      </div>
      {!displayAddress ? (
        <div className="text-muted-foreground">Connect a wallet to view rewards.</div>
      ) : hasSummaryData ? (
        <div className="grid gap-2">
          <div className="grid gap-2 md:hidden">
            {summaryRows.map((item) => (
              <div key={item.protocol} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{item.protocol}</div>
                  {showClaimActions && (
                    (() => {
                      const canClaim = hasClaimableRewards(
                        item.rewards,
                        coinDecimalsMap
                      )
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className={actionButtonClass}
                          onClick={() => handleClaim(item.protocol, item.rewards)}
                          disabled={
                            claimingProtocol !== null
                            || !item.rewards.length
                            || !isProtocolClaimSupported(item.protocol)
                            || swapDisabled
                            || !canClaim
                          }
                          title={
                            !isProtocolClaimSupported(item.protocol)
                              ? "Claim not available"
                              : swapDisabled
                                ? "Swap unavailable"
                                : !canClaim
                                  ? "Amount too small"
                                  : undefined
                          }
                        >
                          {claimingProtocol === item.protocol
                            ? "Claiming..."
                            : swapEnabled
                              ? "Claim + Swap"
                              : "Claim"}
                        </Button>
                      )
                    })()
                  )}
                </div>
                <div className="mt-2 grid gap-2">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Supplied Assets</div>
                    {renderSupplyList(item.supplies, coinDecimalsMap)}
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Rewards</div>
                    {renderRewardList(item.rewards, coinDecimalsMap)}
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Total</div>
                {showClaimActions && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className={actionButtonClass}
                    onClick={handleClaimAll}
                    disabled={
                      claimingProtocol !== null
                      || !hasAnyClaim
                      || swapDisabled
                      || !totalHasClaimableRewards
                    }
                    title={
                      swapDisabled
                        ? "Swap unavailable"
                        : !totalHasClaimableRewards
                          ? "Amount too small"
                          : undefined
                    }
                  >
                    {claimingProtocol === "all"
                      ? "Claiming..."
                      : swapEnabled
                        ? "Claim + Swap All"
                        : "Claim All"}
                  </Button>
                )}
              </div>
              <div className="mt-2 grid gap-2">
                <div>
                  <div className="text-[11px] text-muted-foreground">Supplied Assets</div>
                  {renderSupplyList(totalSupplyList, coinDecimalsMap)}
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Rewards</div>
                  {renderRewardList(totalRewardList, coinDecimalsMap)}
                </div>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[38%]" />
                <col className="w-[38%]" />
                {showClaimActions && <col className="w-[160px]" />}
              </colgroup>
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-1">Protocol</th>
                  <th className="px-2 py-1">Supplied Assets</th>
                  <th className="px-2 py-1">Rewards</th>
                  {showClaimActions && (
                    <th className="px-2 py-1 text-right w-[160px]">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((item) => (
                  <tr key={item.protocol} className="border-b last:border-b-0">
                    <td className="px-2 py-1 font-medium">{item.protocol}</td>
                    <td className="px-2 py-1 align-top whitespace-normal">
                      {renderSupplyList(item.supplies, coinDecimalsMap)}
                    </td>
                    <td className="px-2 py-1 align-top whitespace-normal">
                      {renderRewardList(item.rewards, coinDecimalsMap)}
                    </td>
                    {showClaimActions && (
                      <td className="px-2 py-1 align-top whitespace-nowrap text-right w-[160px]">
                        <div className="flex justify-end">
                          {(() => {
                            const canClaim = hasClaimableRewards(
                              item.rewards,
                              coinDecimalsMap
                            )
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                className={`${actionButtonClass} text-[11px]`}
                                onClick={() => handleClaim(item.protocol, item.rewards)}
                                disabled={
                                  claimingProtocol !== null
                                  || !item.rewards.length
                                  || !isProtocolClaimSupported(item.protocol)
                                  || swapDisabled
                                  || !canClaim
                                }
                                title={
                                  !isProtocolClaimSupported(item.protocol)
                                    ? "Claim not available"
                                    : swapDisabled
                                      ? "Swap unavailable"
                                      : !canClaim
                                        ? "Amount too small"
                                        : undefined
                                }
                              >
                                {claimingProtocol === item.protocol
                                  ? "Claiming..."
                                  : swapEnabled
                                    ? "Claim + Swap"
                                    : "Claim"}
                              </Button>
                            )
                          })()}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="border-t bg-muted/30">
                  <td className="px-2 py-1 font-medium">Total</td>
                  <td className="px-2 py-1 align-top whitespace-normal">
                    {renderSupplyList(totalSupplyList, coinDecimalsMap)}
                  </td>
                  <td className="px-2 py-1 align-top whitespace-normal">
                    {renderRewardList(totalRewardList, coinDecimalsMap)}
                  </td>
                  {showClaimActions && (
                    <td className="px-2 py-1 align-top whitespace-nowrap text-right w-[160px]">
                      <div className="flex justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          className={`${actionButtonClass} text-[11px]`}
                          onClick={handleClaimAll}
                          disabled={
                            claimingProtocol !== null
                            || !hasAnyClaim
                            || swapDisabled
                            || !totalHasClaimableRewards
                          }
                          title={
                            swapDisabled
                              ? "Swap unavailable"
                              : !totalHasClaimableRewards
                                ? "Amount too small"
                                : undefined
                          }
                        >
                          {claimingProtocol === "all"
                            ? "Claiming..."
                            : swapEnabled
                              ? "Claim + Swap All"
                              : "Claim All"}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          {claimError && showClaimActions && (
            <div className="text-xs text-destructive">{claimError}</div>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground">No rewards detected.</div>
      )}
      <AlertDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmTarget(null)
            setSwapPreview(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Swap preview
            </AlertDialogTitle>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmTarget) return
                if (confirmTarget.protocol === "all") {
                  onClaimAll()
                } else {
                  onClaimProtocol(confirmTarget.protocol)
                }
                setConfirmTarget(null)
                setSwapPreview(null)
              }}
              disabled={
                !swapPreview
                || swapPreviewLoading
                || !swapPreview.canSwapAll
                || !swapPreview.items.length
              }
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
