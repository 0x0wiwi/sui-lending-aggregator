import * as React from "react"
import type { Protocol, RewardSummaryItem } from "@/lib/market-data"
import { RewardSummarySwapControls } from "@/components/reward-summary/RewardSummarySwapControls"
import { RewardSummaryMobile } from "@/components/reward-summary/RewardSummaryMobile"
import { RewardSummaryTable } from "@/components/reward-summary/RewardSummaryTable"
import { SwapPreviewDialog } from "@/components/reward-summary/SwapPreviewDialog"

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
    rewards: RewardSummaryItem["rewards"]
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
        <RewardSummarySwapControls
          showClaimActions={showClaimActions}
          swapTargetOptions={swapTargetOptions}
          selectedTargetLabel={selectedTarget}
          slippageLabel={slippageLabel}
          swapEnabled={swapEnabled}
          onSwapEnabledChange={onSwapEnabledChange}
          onSwapTargetChange={onSwapTargetChange}
        />
      </div>
      {!displayAddress ? (
        <div className="text-muted-foreground">Connect a wallet to view rewards.</div>
      ) : hasSummaryData ? (
        <div className="grid gap-2">
          <RewardSummaryMobile
            summaryRows={summaryRows}
            totalSupplyList={totalSupplyList}
            totalRewardList={totalRewardList}
            showClaimActions={showClaimActions}
            claimError={claimError}
            claimingProtocol={claimingProtocol}
            hasAnyClaim={hasAnyClaim}
            coinDecimalsMap={coinDecimalsMap}
            isProtocolClaimSupported={isProtocolClaimSupported}
            onClaim={handleClaim}
            onClaimAll={handleClaimAll}
            swapEnabled={swapEnabled}
            swapDisabled={swapDisabled}
            actionButtonClass={actionButtonClass}
          />
          <RewardSummaryTable
            summaryRows={summaryRows}
            totalSupplyList={totalSupplyList}
            totalRewardList={totalRewardList}
            showClaimActions={showClaimActions}
            claimError={claimError}
            claimingProtocol={claimingProtocol}
            hasAnyClaim={hasAnyClaim}
            coinDecimalsMap={coinDecimalsMap}
            isProtocolClaimSupported={isProtocolClaimSupported}
            onClaim={handleClaim}
            onClaimAll={handleClaimAll}
            swapEnabled={swapEnabled}
            swapDisabled={swapDisabled}
            actionButtonClass={actionButtonClass}
          />
        </div>
      ) : (
        <div className="text-muted-foreground">No rewards detected.</div>
      )}
      <SwapPreviewDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmTarget(null)
            setSwapPreview(null)
          }
        }}
        onCancel={() => {
          setConfirmTarget(null)
          setSwapPreview(null)
        }}
        onContinue={() => {
          if (!confirmTarget) return
          if (confirmTarget.protocol === "all") {
            onClaimAll()
          } else {
            onClaimProtocol(confirmTarget.protocol)
          }
          setConfirmTarget(null)
          setSwapPreview(null)
        }}
        swapPreview={swapPreview}
        swapPreviewLoading={swapPreviewLoading}
        coinDecimalsMap={coinDecimalsMap}
        confirmTarget={confirmTarget}
      />
    </div>
  )
}
