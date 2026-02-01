import { ScallopIndexer, ScallopQuery, type MarketPool } from "@scallop-io/sui-scallop-sdk"

import {
  assetTypeAddresses,
  type AssetSymbol,
  type MarketRow,
  type RewardSummaryItem,
  type RewardSupply,
} from "@/lib/market-data"
import { type WalletPositions } from "@/lib/positions"
import { type MarketFetchResult } from "./types"
import {
  formatTokenSymbol,
  sumBreakdown,
  toAssetSymbolFromSource,
  toNumber,
} from "./utils"

type ScallopBorrowIncentiveReward = {
  token: string
  apr: number
}

function normalizeRewardList(rewardMap: Map<string, number>) {
  return Array.from(rewardMap.entries())
    .map(([token, amount]) => ({ token, amount }))
    .filter((reward) => reward.amount > 0)
}

async function fetchScallopBorrowIncentivePools(): Promise<
  Record<string, ScallopBorrowIncentiveReward[]>
> {
  try {
    const response = await fetch(
      "https://sdk.api.scallop.io/api/borrowIncentivePools/migrate"
    )
    const data = (await response.json()) as Array<{
      pool?: {
        coinName?: string
        rewards?: Array<{
          rewardApr?: number
          symbol?: string
          coinType?: string
        }>
      }
    }>
    return data.reduce<Record<string, ScallopBorrowIncentiveReward[]>>(
      (acc, item) => {
        const pool = item.pool
        if (!pool?.coinName || !pool.rewards?.length) return acc
        const rewards = pool.rewards
          .map((reward) => {
            if (!reward || !reward.rewardApr || reward.rewardApr <= 0) return null
            return {
              token: reward.symbol ?? (reward.coinType ? formatTokenSymbol(reward.coinType) : ""),
              apr: reward.rewardApr * 100,
            }
          })
          .filter(
            (reward): reward is ScallopBorrowIncentiveReward =>
              Boolean(reward && reward.token)
          )
        if (rewards.length) {
          acc[pool.coinName] = rewards
        }
        return acc
      },
      {}
    )
  } catch (error) {
    console.error("Scallop borrow incentive fetch failed:", error)
    return {}
  }
}

export async function fetchScallop(
  address?: string | null
): Promise<MarketFetchResult> {
  const indexer = new ScallopIndexer()
  let market
  try {
    market = await indexer.getMarket()
  } catch (error) {
    console.error("Scallop market fetch failed:", error)
    return { rows: [], positions: {} }
  }
  const spoolsResult = await Promise.allSettled([indexer.getSpools()])
  const spools =
    spoolsResult[0]?.status === "fulfilled" ? spoolsResult[0].value : {}
  const borrowIncentivePools = await fetchScallopBorrowIncentivePools()
  const pools = Object.values(market.pools ?? {})
  const preferredCoinType: Record<AssetSymbol, string> = {
    SUI: assetTypeAddresses.SUI,
    USDC: assetTypeAddresses.USDC,
    USDT: assetTypeAddresses.USDT,
    XBTC: assetTypeAddresses.XBTC,
    DEEP: assetTypeAddresses.DEEP,
    WAL: assetTypeAddresses.WAL,
  }
  const selectedPools = pools.reduce<Partial<Record<AssetSymbol, MarketPool>>>(
    (acc, pool) => {
      if (!pool) return acc
      const poolCoinType =
        (pool as { coinType?: string }).coinType
        ?? (pool as { marketCoinType?: string }).marketCoinType
        ?? null
      const asset = toAssetSymbolFromSource(pool.symbol, poolCoinType)
      if (!asset) return acc
      const preferred = preferredCoinType[asset]
      const existing = acc[asset]
      if (!existing) {
        acc[asset] = pool
        return acc
      }
      const hasIncentive = Boolean(borrowIncentivePools[pool.coinName]?.length)
      const existingHasIncentive = Boolean(
        borrowIncentivePools[existing.coinName]?.length
      )
      if (hasIncentive && !existingHasIncentive) {
        acc[asset] = pool
        return acc
      }
      if (!hasIncentive && existingHasIncentive) return acc
      if (pool.coinType === preferred && existing.coinType !== preferred) {
        acc[asset] = pool
      }
      return acc
    },
    {}
  )

  const rows = Object.values(selectedPools)
    .filter((pool): pool is MarketPool => Boolean(pool))
    .map((pool) => {
      const poolCoinType =
        (pool as { coinType?: string }).coinType
        ?? (pool as { marketCoinType?: string }).marketCoinType
        ?? null
      const asset = toAssetSymbolFromSource(pool.symbol, poolCoinType)
      if (!asset) return null
      const spool = spools[pool.marketCoinType] ?? spools[pool.coinName]
      const supplyRewardApr = spool?.rewardApr ? spool.rewardApr * 100 : 0
      const supplyRewardToken = spool?.rewardCoinType
        ? formatTokenSymbol(spool.rewardCoinType)
        : null
      const borrowRewards = borrowIncentivePools[pool.coinName] ?? []
      const supplyBreakdown =
        supplyRewardApr > 0 && supplyRewardToken
          ? [{ token: supplyRewardToken, apr: supplyRewardApr }]
          : []
      const borrowBreakdown = borrowRewards
      const supplyIncentiveApr = sumBreakdown(supplyBreakdown)
      const borrowIncentiveApr = sumBreakdown(borrowBreakdown)
      const supplyBaseApr = pool.supplyApr * 100
      const borrowBaseApr = pool.borrowApr * 100
      const supplyApr = supplyBaseApr + supplyIncentiveApr
      const borrowApr = Math.max(borrowBaseApr - borrowIncentiveApr, 0)
      const row: MarketRow = {
        asset,
        protocol: "Scallop",
        supplyApr,
        borrowApr,
        utilization: pool.utilizationRate * 100,
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

  const positions: WalletPositions = {}
  let rewardSummary: RewardSummaryItem | undefined
  if (address) {
    try {
      const query = new ScallopQuery()
      const portfolio = await query.getUserPortfolio({
        walletAddress: address,
      })
      const supplies = (portfolio?.lendings ?? []).reduce<RewardSupply[]>(
        (acc, lending) => {
          const asset = toAssetSymbolFromSource(lending.symbol, lending.coinType)
          if (!asset) return acc
          const existing = acc.find((item) => item.asset === asset)
          if (existing) {
            existing.amount += toNumber(lending.suppliedCoin)
          } else {
            acc.push({ asset, amount: toNumber(lending.suppliedCoin) })
          }
          return acc
        },
        []
      )
      const rewardTotals = new Map<string, number>()
      const pending = portfolio?.pendingRewards
      pending?.lendings?.forEach(
        (reward: { symbol?: string; coinType?: string; pendingRewardInCoin?: number }) => {
          const token = reward.symbol ?? formatTokenSymbol(reward.coinType ?? "")
          rewardTotals.set(
            token,
            (rewardTotals.get(token) ?? 0) + toNumber(reward.pendingRewardInCoin)
          )
        }
      )
      pending?.borrowIncentives?.forEach(
        (reward: { symbol?: string; coinType?: string; pendingRewardInCoin?: number }) => {
          const token = reward.symbol ?? formatTokenSymbol(reward.coinType ?? "")
          rewardTotals.set(
            token,
            (rewardTotals.get(token) ?? 0) + toNumber(reward.pendingRewardInCoin)
          )
        }
      )
      rewardSummary = {
        protocol: "Scallop",
        supplies,
        rewards: normalizeRewardList(rewardTotals),
      }
    } catch (error) {
      console.error("Scallop portfolio fetch failed:", error)
    }
  }

  return { rows, positions, rewardSummary }
}
