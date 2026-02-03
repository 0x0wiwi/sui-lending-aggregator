import { Button } from "@/components/ui/button"
import type { Protocol, RewardSummaryItem } from "@/lib/market-data"
import { hasClaimableRewards } from "@/lib/reward-utils"
import { RewardSupplyList, RewardTokenList } from "@/components/reward-summary/RewardSummaryLists"
import { cn } from "@/lib/utils"

type RewardSummaryMobileProps = {
  summaryRows: RewardSummaryItem[]
  totalSupplyList: { asset: string; amount: number }[]
  totalRewardList: RewardSummaryItem["rewards"]
  showClaimActions: boolean
  claimError: string | null
  claimingProtocol: Protocol | "all" | null
  hasAnyClaim: boolean
  coinDecimalsMap: Record<string, number>
  isProtocolClaimSupported: (protocol: Protocol) => boolean
  onClaim: (protocol: Protocol, rewards: RewardSummaryItem["rewards"]) => void
  onClaimAll: () => void
  swapEnabled: boolean
  swapDisabled: boolean
  actionButtonClass: string
}

export function RewardSummaryMobile({
  summaryRows,
  totalSupplyList,
  totalRewardList,
  showClaimActions,
  claimError,
  claimingProtocol,
  hasAnyClaim,
  coinDecimalsMap,
  isProtocolClaimSupported,
  onClaim,
  onClaimAll,
  swapEnabled,
  swapDisabled,
  actionButtonClass,
}: RewardSummaryMobileProps) {
  const totalHasClaimableRewards = hasClaimableRewards(
    totalRewardList,
    coinDecimalsMap
  )
  const mobileButtonClass = cn(actionButtonClass, "w-full")

  return (
    <div className="grid gap-2 md:hidden">
      {summaryRows.map((item) => (
        <div key={item.protocol} className="rounded-md border p-3">
          <div className="flex flex-col items-start gap-2">
            <div className="font-medium">{item.protocol}</div>
            {showClaimActions && (() => {
              const canClaim = hasClaimableRewards(item.rewards, coinDecimalsMap)
              return (
                <Button
                  variant="outline"
                  size="sm"
                  className={mobileButtonClass}
                  onClick={() => onClaim(item.protocol, item.rewards)}
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
          <div className="mt-2 grid gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground">Supplied Assets</div>
              <RewardSupplyList
                supplies={item.supplies}
                decimalsMap={coinDecimalsMap}
              />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Rewards</div>
              <RewardTokenList rewards={item.rewards} decimalsMap={coinDecimalsMap} />
            </div>
          </div>
        </div>
      ))}
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex flex-col items-start gap-2">
          <div className="font-medium">Total</div>
          {showClaimActions && (
            <Button
              variant="secondary"
              size="sm"
              className={mobileButtonClass}
              onClick={onClaimAll}
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
            <RewardSupplyList
              supplies={totalSupplyList}
              decimalsMap={coinDecimalsMap}
            />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Rewards</div>
            <RewardTokenList
              rewards={totalRewardList}
              decimalsMap={coinDecimalsMap}
            />
          </div>
        </div>
      </div>
      {claimError && showClaimActions && (
        <div className="text-xs text-destructive">{claimError}</div>
      )}
    </div>
  )
}
