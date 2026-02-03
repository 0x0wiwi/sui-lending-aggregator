import type { MarketRow, RewardSummaryItem } from "@/lib/market-data"
import type { WalletPositions } from "@/lib/positions"

export type MarketFetchResult = {
  rows: MarketRow[]
  positions: WalletPositions
  rewardSummary?: RewardSummaryItem
}

export type MarketOnlyResult = {
  rows: MarketRow[]
}

export type UserOnlyResult = {
  positions: WalletPositions
  rewardSummary?: RewardSummaryItem
}

export type MarketSnapshot = {
  rows: MarketRow[]
  positions: WalletPositions
  rewardSummary: RewardSummaryItem[]
}
