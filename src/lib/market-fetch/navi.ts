import {
  getLendingState,
  getPools,
  getUserAvailableLendingRewards,
  type Pool,
} from "@naviprotocol/lending"

import {
  assetTypeAddresses,
  type AssetSymbol,
  type IncentiveBreakdown,
  type MarketRow,
  type RewardSummaryItem,
} from "@/lib/market-data"
import { createPositionKey, type WalletPositions } from "@/lib/positions"
import { type MarketFetchResult, type MarketOnlyResult, type UserOnlyResult } from "./types"
import {
  buildSupplyList,
  formatTokenSymbol,
  sumBreakdown,
  toAssetSymbolFromSource,
  toNumber,
} from "./utils"

function buildNaviIncentives(
  rewardCoinTypes: string[] | undefined,
  aprValue: number
): IncentiveBreakdown[] {
  if (!rewardCoinTypes?.length || aprValue <= 0) return []
  const perToken = aprValue / rewardCoinTypes.length
  return rewardCoinTypes.map((coinType) => ({
    token: formatTokenSymbol(coinType),
    apr: perToken,
  }))
}

export async function fetchNaviMarket(): Promise<MarketOnlyResult> {
  try {
    const pools = await getPools({ env: "prod" })
    const preferredCoinType: Record<AssetSymbol, string> = {
      SUI: assetTypeAddresses.SUI,
      USDC: assetTypeAddresses.USDC,
      USDT: assetTypeAddresses.USDT,
      XBTC: assetTypeAddresses.XBTC,
      DEEP: assetTypeAddresses.DEEP,
      WAL: assetTypeAddresses.WAL,
    }
    const selectedPools = pools.reduce<Partial<Record<AssetSymbol, Pool>>>(
      (acc, pool) => {
        const token = pool.token as
          | { symbol?: string; address?: string; coinType?: string }
          | undefined
        const asset = toAssetSymbolFromSource(
          token?.symbol,
          token?.address ?? token?.coinType
        )
        if (!asset) return acc
        const existing = acc[asset]
        if (!existing) {
          acc[asset] = pool
          return acc
        }
        const preferred = preferredCoinType[asset]
        const isPreferred =
          token?.address === preferred || token?.coinType === preferred
        const existingToken = existing.token as
          | { address?: string; coinType?: string }
          | undefined
        const existingPreferred =
          existingToken?.address === preferred || existingToken?.coinType === preferred
        if (isPreferred && !existingPreferred) {
          acc[asset] = pool
          return acc
        }
        if (pool.isSuiBridge && !existing.isSuiBridge && !existingPreferred) {
          acc[asset] = pool
        }
        return acc
      },
      {}
    )
    const rows = Object.values(selectedPools)
      .filter((pool): pool is Pool => Boolean(pool))
      .map((pool) => {
        const token = pool.token as
          | { symbol?: string; address?: string; coinType?: string }
          | undefined
        const asset = toAssetSymbolFromSource(
          token?.symbol,
          token?.address ?? token?.coinType
        )
        if (!asset) return null
        const supplyAprBase =
          toNumber(pool.supplyIncentiveApyInfo?.vaultApr)
          || toNumber(pool.currentSupplyRate) / 1e25
        const borrowAprBase =
          toNumber(pool.borrowIncentiveApyInfo?.vaultApr)
          || toNumber(pool.currentBorrowRate) / 1e25
        const utilization =
          pool.totalSupplyAmount && pool.borrowedAmount
            ? (toNumber(pool.borrowedAmount) / toNumber(pool.totalSupplyAmount)) * 100
            : 0
        const supplyIncentiveApr = toNumber(pool.supplyIncentiveApyInfo?.boostedApr)
        const borrowIncentiveApr = toNumber(pool.borrowIncentiveApyInfo?.boostedApr)
        const supplyBreakdown = buildNaviIncentives(
          pool.supplyIncentiveApyInfo?.rewardCoin,
          supplyIncentiveApr
        )
        const borrowBreakdown = buildNaviIncentives(
          pool.borrowIncentiveApyInfo?.rewardCoin,
          borrowIncentiveApr
        )
        const supplyIncentiveTotal = sumBreakdown(supplyBreakdown)
        const borrowIncentiveTotal = sumBreakdown(borrowBreakdown)
        const supplyNetApr =
          toNumber(pool.supplyIncentiveApyInfo?.apy) || supplyAprBase + supplyIncentiveTotal
        const borrowNetApr =
          toNumber(pool.borrowIncentiveApyInfo?.apy)
          || Math.max(borrowAprBase - borrowIncentiveTotal, 0)
        const row: MarketRow = {
          asset,
          protocol: "Navi",
          supplyApr: supplyNetApr,
          borrowApr: borrowNetApr,
          utilization,
          supplyBaseApr: supplyAprBase,
          borrowBaseApr: borrowAprBase,
          supplyIncentiveApr: supplyIncentiveTotal,
          borrowIncentiveApr: borrowIncentiveTotal,
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

    return { rows }
  } catch (error) {
    console.error("Navi market fetch failed:", error)
    return { rows: [] }
  }
}

export async function fetchNaviUser(address?: string | null): Promise<UserOnlyResult> {
  let positions: WalletPositions = {}
  let rewardSummary: RewardSummaryItem | undefined
  if (address) {
    const lendingStates = await getLendingState(address, { env: "prod" })
    positions = lendingStates.reduce<WalletPositions>((acc, state) => {
      const token = state.pool?.token as
        | { symbol?: string; address?: string; coinType?: string }
        | undefined
      const asset = toAssetSymbolFromSource(
        token?.symbol,
        token?.address ?? token?.coinType
      )
      if (!asset) return acc
      const key = createPositionKey("Navi", asset)
      const amount = toNumber(state.supplyBalance)
      acc[key] = (acc[key] ?? 0) + amount
      return acc
    }, {})
    rewardSummary = {
      protocol: "Navi",
      supplies: buildSupplyList(positions, "Navi"),
      rewards: [],
    }
    try {
      const rewards = await getUserAvailableLendingRewards(address, { env: "prod" })
      const rewardTotals = new Map<string, number>()
      rewards
        .filter((reward) => reward.userClaimableReward > 0)
        .forEach((reward) => {
          rewardTotals.set(
            reward.rewardCoinType,
            (rewardTotals.get(reward.rewardCoinType) ?? 0)
              + toNumber(reward.userClaimableReward)
          )
        })
      rewardSummary.rewards = Array.from(rewardTotals.entries())
        .map(([coinType, amount]) => ({
          token: formatTokenSymbol(coinType),
          amount,
          coinType,
        }))
        .filter((reward) => reward.amount > 0)
    } catch (error) {
      console.error("Navi reward fetch failed:", error)
    }
  }

  return { positions, rewardSummary }
}

export async function fetchNavi(address?: string | null): Promise<MarketFetchResult> {
  const [market, user] = await Promise.all([
    fetchNaviMarket(),
    fetchNaviUser(address),
  ])
  return {
    rows: market.rows,
    positions: user.positions,
    rewardSummary: user.rewardSummary,
  }
}
