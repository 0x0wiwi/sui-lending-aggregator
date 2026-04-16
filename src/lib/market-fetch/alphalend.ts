import type { RewardSummaryItem } from "@/lib/market-data"
import type { WalletPositions } from "@/lib/positions"
import type { MarketFetchResult, MarketOnlyResult, UserOnlyResult } from "./types"

export const ALPHALEND_DISABLED_REASON =
  "AlphaLend is temporarily disabled until its SDK supports @mysten/sui 2.x."

export async function fetchAlphaLendMarket(): Promise<MarketOnlyResult> {
  return { rows: [] }
}

export async function fetchAlphaLendUser(
  address?: string | null
): Promise<UserOnlyResult> {
  void address
  const positions: WalletPositions = {}
  const rewardSummary: RewardSummaryItem | undefined = undefined
  return { positions, rewardSummary }
}

export async function fetchAlphaLend(
  address?: string | null
): Promise<MarketFetchResult> {
  const [market, user] = await Promise.all([
    fetchAlphaLendMarket(),
    fetchAlphaLendUser(address),
  ])
  return {
    rows: market.rows,
    positions: user.positions,
    rewardSummary: user.rewardSummary,
  }
}
