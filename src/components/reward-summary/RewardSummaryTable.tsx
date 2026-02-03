import { Button } from "@/components/ui/button"
import type { Protocol, RewardSummaryItem } from "@/lib/market-data"
import { hasClaimableRewards } from "@/lib/reward-utils"
import { RewardSupplyList, RewardTokenList } from "@/components/reward-summary/RewardSummaryLists"

type RewardSummaryTableProps = {
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

export function RewardSummaryTable({
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
}: RewardSummaryTableProps) {
  const totalHasClaimableRewards = hasClaimableRewards(
    totalRewardList,
    coinDecimalsMap
  )

  return (
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
                <RewardSupplyList supplies={item.supplies} decimalsMap={coinDecimalsMap} />
              </td>
              <td className="px-2 py-1 align-top whitespace-normal">
                <RewardTokenList rewards={item.rewards} decimalsMap={coinDecimalsMap} />
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
                </td>
              )}
            </tr>
          ))}
          <tr className="border-t bg-muted/30">
            <td className="px-2 py-1 font-medium">Total</td>
            <td className="px-2 py-1 align-top whitespace-normal">
              <RewardSupplyList supplies={totalSupplyList} decimalsMap={coinDecimalsMap} />
            </td>
            <td className="px-2 py-1 align-top whitespace-normal">
              <RewardTokenList rewards={totalRewardList} decimalsMap={coinDecimalsMap} />
            </td>
            {showClaimActions && (
              <td className="px-2 py-1 align-top whitespace-nowrap text-right w-[160px]">
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    className={`${actionButtonClass} text-[11px]`}
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
                </div>
              </td>
            )}
          </tr>
        </tbody>
      </table>
      {claimError && showClaimActions && (
        <div className="text-xs text-destructive">{claimError}</div>
      )}
    </div>
  )
}
