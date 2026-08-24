import type { RewardSummaryItem } from "@/lib/market-data"
import { renderAlignedNumber } from "@/components/reward-summary/formatters"

type RewardSupplyListProps = {
  supplies: { asset: string; amount: number }[]
}

type RewardTokenListProps = {
  rewards: RewardSummaryItem["rewards"]
}

export function RewardSupplyList({
  supplies,
}: RewardSupplyListProps) {
  if (!supplies.length) return "—"
  return (
    <div className="grid gap-1">
      {supplies.map((item) => (
        <div
          key={item.asset}
          className="grid grid-cols-[5ch_1fr] items-baseline gap-3"
        >
          <span className="font-medium">{item.asset}</span>
          <span>{renderAlignedNumber(item.amount)}</span>
        </div>
      ))}
    </div>
  )
}

export function RewardTokenList({ rewards }: RewardTokenListProps) {
  if (!rewards.length) return "—"
  return (
    <div className="grid gap-1">
      {rewards.map((item) => (
        <div
          key={`${item.token}-${item.coinType ?? "unknown"}`}
          className="grid grid-cols-[5ch_1fr] items-baseline gap-3"
        >
          <span className="font-medium">{item.token}</span>
          <span>{renderAlignedNumber(item.amount)}</span>
        </div>
      ))}
    </div>
  )
}
