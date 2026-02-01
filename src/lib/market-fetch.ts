import {
  ScallopIndexer,
  ScallopQuery,
  type MarketPool,
} from "@scallop-io/sui-scallop-sdk"
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client"
import { getPools, getLendingState, type Pool } from "@naviprotocol/lending"
import { AlphalendClient } from "@alphafi/alphalend-sdk"
import {
  formatRewards,
  getDedupedAprRewards,
  getFilteredRewards,
} from "@suilend/sdk/lib/liquidityMining"
import { Side } from "@suilend/sdk/lib/types"
import {
  initializeObligations,
  initializeSuilend,
  initializeSuilendRewards,
} from "@suilend/sdk/lib/initialize"
import { LENDING_MARKET_ID, LENDING_MARKET_TYPE, SuilendClient } from "@suilend/sdk/client"

import {
  assetTypeAddresses,
  normalizeAssetSymbol,
  supportedProtocols,
  type MarketRow,
  type AssetSymbol,
  type RewardSummaryItem,
  type RewardSupply,
} from "@/lib/market-data"
import { createPositionKey, type WalletPositions } from "@/lib/positions"

type MarketFetchResult = {
  rows: MarketRow[]
  positions: WalletPositions
  rewardSummary?: RewardSummaryItem
}

type MarketSnapshot = {
  rows: MarketRow[]
  positions: WalletPositions
  rewardSummary: RewardSummaryItem[]
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return 0
}

function toAssetSymbolFromSource(
  symbol?: string | null,
  coinType?: string | null
): AssetSymbol | null {
  return normalizeAssetSymbol(coinType) ?? normalizeAssetSymbol(symbol)
}

function formatTokenSymbol(coinType: string) {
  const parts = coinType.split("::")
  return parts[parts.length - 1] ?? coinType
}

function sumBreakdown(items: { apr: number }[]) {
  return items.reduce((sum, item) => sum + item.apr, 0)
}

function buildSupplyList(
  positions: WalletPositions,
  protocol: RewardSummaryItem["protocol"]
) {
  return Object.entries(positions)
    .filter(([key, amount]) => key.startsWith(`${protocol}-`) && amount > 0)
    .map(([key, amount]) => {
      const [, asset] = key.split("-") as [string, AssetSymbol]
      return { asset, amount }
    })
}

function normalizeRewardList(rewardMap: Map<string, number>) {
  return Array.from(rewardMap.entries())
    .map(([token, amount]) => ({ token, amount }))
    .filter((reward) => reward.amount > 0)
}

async function fetchScallop(address?: string | null): Promise<MarketFetchResult> {
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
        (pool as { coinType?: string }).coinType ??
        (pool as { marketCoinType?: string }).marketCoinType ??
        null
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
        (pool as { coinType?: string }).coinType ??
        (pool as { marketCoinType?: string }).marketCoinType ??
        null
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
          const asset = toAssetSymbolFromSource(
            lending.symbol,
            lending.coinType
          )
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
      })
      pending?.borrowIncentives?.forEach(
        (reward: { symbol?: string; coinType?: string; pendingRewardInCoin?: number }) => {
        const token = reward.symbol ?? formatTokenSymbol(reward.coinType ?? "")
        rewardTotals.set(
          token,
          (rewardTotals.get(token) ?? 0) + toNumber(reward.pendingRewardInCoin)
        )
      })
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

type ScallopBorrowIncentiveReward = {
  token: string
  apr: number
}

async function fetchScallopBorrowIncentivePools(): Promise<
  Record<string, ScallopBorrowIncentiveReward[]>
> {
  try {
    const response = await fetch(
      "https://sdk.api.scallop.io/api/borrowIncentivePools/migrate"
    )
    if (!response.ok) return {}
    const data = (await response.json()) as Array<{
      coinName: string
      rewards?: Array<{
        symbol?: string
        coinType?: string
        rewardApr?: number
      }>
    }>
    return data.reduce<Record<string, ScallopBorrowIncentiveReward[]>>(
      (acc, pool) => {
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
            (
              reward
            ): reward is ScallopBorrowIncentiveReward =>
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

function buildNaviIncentives(
  rewardCoinTypes: string[] | undefined,
  aprValue: number
) {
  if (!rewardCoinTypes?.length || aprValue <= 0) return []
  const perToken = aprValue / rewardCoinTypes.length
  return rewardCoinTypes.map((coinType) => ({
    token: formatTokenSymbol(coinType),
    apr: perToken,
  }))
}

async function fetchNavi(address?: string | null): Promise<MarketFetchResult> {
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
      const supplyAprBase = toNumber(pool.supplyIncentiveApyInfo?.vaultApr)
        || toNumber(pool.currentSupplyRate) / 1e25
      const borrowAprBase = toNumber(pool.borrowIncentiveApyInfo?.vaultApr)
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
      const supplyNetApr = toNumber(pool.supplyIncentiveApyInfo?.apy)
        || supplyAprBase + supplyIncentiveTotal
      const borrowNetApr = toNumber(pool.borrowIncentiveApyInfo?.apy)
        || Math.max(borrowAprBase - borrowIncentiveTotal, 0)
      const supplyApr = supplyNetApr
      const borrowApr = borrowNetApr
      const row: MarketRow = {
        asset,
        protocol: "Navi",
        supplyApr,
        borrowApr,
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

  let positions: WalletPositions = {}
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
  }

  return { rows, positions }
}

function selectSuilendReserves<
  T extends {
    token: { symbol: string }
    depositAprPercent: unknown
    borrowAprPercent: unknown
  }
>(reserves: T[]) {
  const preferredCoinType: Record<AssetSymbol, string> = {
    SUI: assetTypeAddresses.SUI,
    USDC: assetTypeAddresses.USDC,
    USDT: assetTypeAddresses.USDT,
    XBTC: assetTypeAddresses.XBTC,
    DEEP: assetTypeAddresses.DEEP,
    WAL: assetTypeAddresses.WAL,
  }
  return reserves.reduce<Partial<Record<AssetSymbol, T>>>((acc, reserve) => {
    const asset = toAssetSymbolFromSource(
      reserve.token?.symbol,
      (reserve as { coinType?: string }).coinType ?? null
    )
    if (!asset) return acc
    const existing = acc[asset]
    if (!existing) {
      acc[asset] = reserve
      return acc
    }
    const preferred = preferredCoinType[asset]
    const isPreferred =
      (reserve as { coinType?: string }).coinType === preferred
    const existingPreferred =
      (existing as { coinType?: string }).coinType === preferred
    if (isPreferred && !existingPreferred) {
      acc[asset] = reserve
      return acc
    }
    if (existingPreferred && !isPreferred) return acc
    const reserveScore =
      toNumber(reserve.depositAprPercent) + toNumber(reserve.borrowAprPercent)
    const existingScore =
      toNumber(existing.depositAprPercent) + toNumber(existing.borrowAprPercent)
    if (reserveScore > existingScore) {
      acc[asset] = reserve
    }
    return acc
  }, {})
}

async function fetchSuilend(address?: string | null): Promise<MarketFetchResult> {
  try {
    const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") })
    const suilendClient = await SuilendClient.initialize(
      LENDING_MARKET_ID,
      LENDING_MARKET_TYPE,
      suiClient
    )
    const { reserveMap, coinMetadataMap, refreshedRawReserves, activeRewardCoinTypes } =
      await initializeSuilend(suiClient, suilendClient)
    const { rewardPriceMap } = await initializeSuilendRewards(
      reserveMap,
      activeRewardCoinTypes
    )
    const rewardMap = formatRewards(reserveMap, coinMetadataMap, rewardPriceMap)

    const selectedReserves = selectSuilendReserves(Object.values(reserveMap))
    const rows = Object.values(selectedReserves)
      .map((reserve) => {
        const asset = toAssetSymbolFromSource(
          reserve.token.symbol,
          reserve.coinType ?? null
        )
        if (!asset) return null
        const supplyBaseApr = toNumber(reserve.depositAprPercent)
        const borrowBaseApr = toNumber(reserve.borrowAprPercent)
        const utilization = toNumber(reserve.utilizationPercent)
        const rewards = rewardMap[reserve.coinType]
        const supplyRewards = rewards?.deposit ?? []
        const borrowRewards = rewards?.borrow ?? []
        const supplyBreakdown = getDedupedAprRewards(
          getFilteredRewards(supplyRewards)
        )
          .map((reward) => {
            const aprValue = toNumber(reward.stats.aprPercent)
            if (!aprValue || !isFinite(aprValue) || aprValue <= 0) return null
            return {
              token: reward.stats.symbol,
              apr: aprValue,
            }
          })
          .filter(
            (reward): reward is { token: string; apr: number } => Boolean(reward)
          )
        const borrowBreakdown = getDedupedAprRewards(
          getFilteredRewards(borrowRewards)
        )
          .map((reward) => {
            const aprValue = toNumber(reward.stats.aprPercent)
            if (!aprValue || !isFinite(aprValue) || aprValue <= 0) return null
            return {
              token: reward.stats.symbol,
              apr: aprValue,
            }
          })
          .filter(
            (reward): reward is { token: string; apr: number } => Boolean(reward)
          )
        const supplyIncentiveApr = sumBreakdown(supplyBreakdown)
        const borrowIncentiveApr = sumBreakdown(borrowBreakdown)
        const supplyApr = supplyBaseApr + supplyIncentiveApr
        const borrowApr = Math.max(borrowBaseApr - borrowIncentiveApr, 0)
        const row: MarketRow = {
          asset,
          protocol: "Suilend",
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
      const obligationsResult = await initializeObligations(
        suiClient,
        suilendClient,
        refreshedRawReserves,
        reserveMap,
        address
      )
      positions = obligationsResult.obligations.reduce<WalletPositions>(
        (acc, obligation) => {
          obligation.deposits.forEach((deposit) => {
            const asset = toAssetSymbolFromSource(
              deposit.reserve.token.symbol,
              deposit.reserve.coinType ?? null
            )
            if (!asset) return
            const key = createPositionKey("Suilend", asset)
            const amount = toNumber(deposit.depositedAmount)
            acc[key] = (acc[key] ?? 0) + amount
          })
          return acc
        },
        {}
      )
      const rewardMapWithClaims = formatRewards(
        reserveMap,
        coinMetadataMap,
        rewardPriceMap,
        obligationsResult.obligations
      )
      const rewardTotals = new Map<string, number>()
      obligationsResult.obligations.forEach((obligation) => {
        obligation.deposits.forEach((deposit) => {
          const rewards = rewardMapWithClaims[deposit.reserve.coinType]?.[
            Side.DEPOSIT
          ]
          rewards?.forEach((reward) => {
            const claim = reward.obligationClaims?.[obligation.id]
            const amount = claim ? toNumber(claim.claimableAmount) : 0
            if (amount > 0) {
              rewardTotals.set(
                reward.stats.symbol,
                (rewardTotals.get(reward.stats.symbol) ?? 0) + amount
              )
            }
          })
        })
        obligation.borrows.forEach((borrow) => {
          const rewards = rewardMapWithClaims[borrow.reserve.coinType]?.[
            Side.BORROW
          ]
          rewards?.forEach((reward) => {
            const claim = reward.obligationClaims?.[obligation.id]
            const amount = claim ? toNumber(claim.claimableAmount) : 0
            if (amount > 0) {
              rewardTotals.set(
                reward.stats.symbol,
                (rewardTotals.get(reward.stats.symbol) ?? 0) + amount
              )
            }
          })
        })
      })
      rewardSummary = {
        protocol: "Suilend",
        supplies: buildSupplyList(positions, "Suilend"),
        rewards: normalizeRewardList(rewardTotals),
      }
    }

    return { rows, positions, rewardSummary }
  } catch (error) {
    console.error("Suilend fetch failed:", error)
    return { rows: [], positions: {} }
  }
}

async function fetchAlphaLend(address?: string | null): Promise<MarketFetchResult> {
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
        const row: MarketRow = {
          asset,
          protocol: "AlphaLend",
          supplyApr,
          borrowApr,
          utilization: toNumber(market.utilizationRate) * 100,
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
        | Array<{ suppliedAmounts?: Map<number, unknown> }>
        | undefined
      positions = (portfolios ?? []).reduce<WalletPositions>(
        (acc, portfolio) => {
          const suppliedAmounts = portfolio?.suppliedAmounts
          if (!suppliedAmounts) return acc
          for (const [marketId, amount] of suppliedAmounts.entries()) {
            const market = marketById.get(String(marketId))
            if (!market) continue
            const asset = toAssetSymbolFromSource(null, market.coinType)
            if (!asset) continue
            const key = createPositionKey("AlphaLend", asset)
            const numericAmount = toNumber(amount)
            acc[key] = (acc[key] ?? 0) + numericAmount
          }
          return acc
        },
        {}
      )
      const rewardTotals = new Map<string, number>()
      ;(portfolios ?? []).forEach((portfolio) => {
        const rewards = (portfolio as { rewardsToClaim?: Array<{ coinType: string; rewardAmount: unknown }> })
          .rewardsToClaim
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
        rewards: normalizeRewardList(rewardTotals),
      }
    }

    return { rows, positions, rewardSummary }
  } catch (error) {
    console.error("AlphaLend fetch failed:", error)
    return { rows: [], positions: {} }
  }
}

function mergePositions(all: WalletPositions[]) {
  return all.reduce<WalletPositions>((acc, positions) => {
    Object.entries(positions).forEach(([key, value]) => {
      if (typeof value !== "number") return
      const typedKey = key as keyof WalletPositions
      acc[typedKey] = (acc[typedKey] ?? 0) + value
    })
    return acc
  }, {})
}

export async function fetchMarketSnapshot(
  address?: string | null
): Promise<MarketSnapshot> {
  const results = await Promise.allSettled([
    fetchScallop(address),
    fetchNavi(address),
    fetchSuilend(address),
    fetchAlphaLend(address),
  ])

  const rows = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value.rows : []
  )
  const positions = mergePositions(
    results
      .filter((result): result is PromiseFulfilledResult<MarketFetchResult> => result.status === "fulfilled")
      .map((result) => result.value.positions)
  )

  const summaryMap = new Map<RewardSummaryItem["protocol"], RewardSummaryItem>()
  supportedProtocols.forEach((protocol) => {
    summaryMap.set(protocol, {
      protocol,
      supplies: buildSupplyList(positions, protocol),
      rewards: [],
    })
  })
  results.forEach((result) => {
    if (result.status !== "fulfilled") return
    const summary = result.value.rewardSummary
    if (!summary) return
    const existing = summaryMap.get(summary.protocol)
    summaryMap.set(summary.protocol, {
      protocol: summary.protocol,
      supplies: summary.supplies.length ? summary.supplies : existing?.supplies ?? [],
      rewards: summary.rewards,
    })
  })

  return {
    rows,
    positions,
    rewardSummary: Array.from(summaryMap.values()),
  }
}
