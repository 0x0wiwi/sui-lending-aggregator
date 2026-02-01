import { AlphalendClient } from "@alphafi/alphalend-sdk"
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client"

import {
  type MarketRow,
  type RewardSummaryItem,
} from "@/lib/market-data"
import { createPositionKey, type WalletPositions } from "@/lib/positions"
import { type MarketFetchResult } from "./types"
import {
  buildSupplyList,
  formatTokenSymbol,
  sumBreakdown,
  toAssetSymbolFromSource,
  toNumber,
} from "./utils"

export async function fetchAlphaLend(
  address?: string | null
): Promise<MarketFetchResult> {
  try {
    const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") })
    const alphalendClient = new AlphalendClient("mainnet", suiClient)
    const markets = await alphalendClient.getAllMarkets()
    const marketList = Array.isArray(markets) ? markets : []
    const marketById = new Map(
      marketList.map((market) => [String(market.marketId), market])
    )

    const rows = marketList
      .map((market) => {
        const asset = toAssetSymbolFromSource(null, market.coinType)
        if (!asset) return null
        const supplyBaseApr = toNumber(market.supplyApr?.interestApr)
        const borrowBaseApr = toNumber(market.borrowApr?.interestApr)
        const supplyRewards = (market.supplyApr?.rewards ?? []) as Array<{
          coinType: string
          rewardApr: unknown
        }>
        const borrowRewards = (market.borrowApr?.rewards ?? []) as Array<{
          coinType: string
          rewardApr: unknown
        }>
        const supplyBreakdown = supplyRewards
          .map((reward) => ({
            token: formatTokenSymbol(reward.coinType),
            apr: toNumber(reward.rewardApr),
          }))
          .filter((reward) => reward.apr > 0)
        const borrowBreakdown = borrowRewards
          .map((reward) => ({
            token: formatTokenSymbol(reward.coinType),
            apr: toNumber(reward.rewardApr),
          }))
          .filter((reward) => reward.apr > 0)
        const supplyIncentiveApr = sumBreakdown(supplyBreakdown)
        const borrowIncentiveApr = sumBreakdown(borrowBreakdown)
        const supplyApr = supplyBaseApr + supplyIncentiveApr
        const borrowApr = Math.max(borrowBaseApr - borrowIncentiveApr, 0)
        const utilization = toNumber((market as { utilizationRate?: unknown }).utilizationRate) * 100
        const row: MarketRow = {
          asset,
          protocol: "AlphaLend",
          supplyApr,
          borrowApr,
          utilization,
          supplyBaseApr,
          borrowBaseApr,
          supplyIncentiveApr,
          borrowIncentiveApr,
        }
        if (supplyBreakdown.length) {
          row.supplyIncentiveBreakdown = supplyBreakdown
        }
        if (borrowBreakdown.length) {
          row.borrowIncentiveBreakdown = borrowBreakdown
        }
        return row
      })
      .filter((row): row is MarketRow => Boolean(row))

    let positions: WalletPositions = {}
    let rewardSummary: RewardSummaryItem | undefined
    if (address) {
      const portfolios = (await alphalendClient.getUserPortfolio(address)) as
        | Array<{
            suppliedAmounts?: Map<number, unknown>
            rewardsToClaim?: Array<{ coinType: string; rewardAmount: unknown }>
          }>
        | undefined
      positions = (portfolios ?? []).reduce<WalletPositions>((acc, portfolio) => {
        const suppliedAmounts = portfolio?.suppliedAmounts
        if (!suppliedAmounts) return acc
        for (const [marketId, amount] of suppliedAmounts.entries()) {
          const market = marketById.get(String(marketId))
          if (!market) continue
          const asset = toAssetSymbolFromSource(null, market.coinType)
          if (!asset) continue
          const key = createPositionKey("AlphaLend", asset)
          acc[key] = (acc[key] ?? 0) + toNumber(amount)
        }
        return acc
      }, {})
      const rewardTotals = new Map<string, number>()
      ;(portfolios ?? []).forEach((portfolio) => {
        const rewards = portfolio?.rewardsToClaim
        rewards?.forEach((reward) => {
          const token = formatTokenSymbol(reward.coinType)
          const amount = toNumber(reward.rewardAmount)
          if (amount > 0) {
            rewardTotals.set(token, (rewardTotals.get(token) ?? 0) + amount)
          }
        })
      })
      rewardSummary = {
        protocol: "AlphaLend",
        supplies: buildSupplyList(positions, "AlphaLend"),
        rewards: Array.from(rewardTotals.entries())
          .map(([token, amount]) => ({ token, amount }))
          .filter((reward) => reward.amount > 0),
      }
    }

    return { rows, positions, rewardSummary }
  } catch (error) {
    console.error("AlphaLend fetch failed:", error)
    return { rows: [], positions: {} }
  }
}
