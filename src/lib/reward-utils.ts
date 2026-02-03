import BigNumber from "bignumber.js"
import type { RewardSummaryItem } from "@/lib/market-data"

export function normalizeRewardAmount(
  amount: number,
  coinType: string | undefined,
  decimalsMap: Record<string, number>
) {
  if (!coinType) return amount
  const decimals = decimalsMap[coinType]
  if (decimals === undefined) return amount
  return Number(new BigNumber(amount).toFixed(decimals, BigNumber.ROUND_FLOOR))
}

export function normalizeRewards(
  rewards: RewardSummaryItem["rewards"],
  decimalsMap: Record<string, number>
) {
  return rewards.map((reward) => ({
    ...reward,
    amount: normalizeRewardAmount(reward.amount, reward.coinType, decimalsMap),
  }))
}

export function hasClaimableRewards(
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
