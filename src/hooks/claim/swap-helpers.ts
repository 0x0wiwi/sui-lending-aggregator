import BN from "bn.js"
import BigNumber from "bignumber.js"
import type { RewardSummaryItem } from "@/lib/market-data"

export function formatAtomicAmount(amount: BN, decimals: number) {
  const raw = amount.toString(10)
  if (decimals <= 0) return raw
  const padded = raw.padStart(decimals + 1, "0")
  const whole = padded.slice(0, -decimals)
  let fraction = padded.slice(-decimals)
  fraction = fraction.replace(/0+$/, "")
  if (!fraction) return whole
  const limited = fraction.slice(0, 12)
  return `${whole}.${limited}`
}

export function toAtomicAmount(
  amount: number,
  coinType: string,
  coinDecimalsMap: Record<string, number>
) {
  const decimals = coinDecimalsMap[coinType]
  if (decimals === undefined) return null
  return new BN(
    new BigNumber(amount)
      .shiftedBy(decimals)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toString(10)
  )
}

export function buildRewardAmountMap(
  rewards: RewardSummaryItem["rewards"]
) {
  const map = new Map<string, number>()
  rewards.forEach((reward) => {
    if (!reward.coinType) return
    map.set(
      reward.coinType,
      (map.get(reward.coinType) ?? 0) + reward.amount
    )
  })
  return map
}
