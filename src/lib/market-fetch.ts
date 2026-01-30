import { Scallop, type MarketPool } from "@scallop-io/sui-scallop-sdk"
import { getPools, getLendingState, type Pool } from "@naviprotocol/lending"

import { normalizeAssetSymbol, type MarketRow, type AssetSymbol } from "@/lib/market-data"
import { createPositionKey, type WalletPositions } from "@/lib/positions"

type MarketFetchResult = {
  rows: MarketRow[]
  positions: WalletPositions
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return 0
}

function toAssetSymbol(value?: string | null): AssetSymbol | null {
  return normalizeAssetSymbol(value)
}

function formatTokenSymbol(coinType: string) {
  const parts = coinType.split("::")
  return parts[parts.length - 1] ?? coinType
}

function sumBreakdown(items: { apr: number }[]) {
  return items.reduce((sum, item) => sum + item.apr, 0)
}

async function fetchScallop(address?: string | null): Promise<MarketFetchResult> {
  const scallop = new Scallop({ networkType: "mainnet" })
  await scallop.init()
  const query = scallop.client.query
  const market = await query.queryMarket({ indexer: true })
  const pools = Object.values(market.pools ?? {})
  const preferredCoinName: Record<AssetSymbol, string> = {
    SUI: "sui",
    USDC: "wusdc",
    USDT: "wusdt",
  }
  const selectedPools = pools.reduce<Partial<Record<AssetSymbol, MarketPool>>>(
    (acc, pool) => {
      if (!pool) return acc
      const asset = toAssetSymbol(pool.symbol)
      if (!asset) return acc
      const preferred = preferredCoinName[asset]
      const existing = acc[asset]
      if (!existing) {
        acc[asset] = pool
        return acc
      }
      if (pool.coinName === preferred && existing.coinName !== preferred) {
        acc[asset] = pool
      }
      return acc
    },
    {}
  )

  const rows = Object.values(selectedPools)
    .filter((pool): pool is MarketPool => Boolean(pool))
    .map((pool) => {
      const asset = toAssetSymbol(pool.symbol)
      if (!asset) return null
      const row: MarketRow = {
        asset,
        protocol: "Scallop",
        supplyApr: pool.supplyApr * 100,
        borrowApr: pool.borrowApr * 100,
        incentiveApr: 0,
        utilization: pool.utilizationRate * 100,
      }
      return row
    })
    .filter((row): row is MarketRow => Boolean(row))

  let positions: WalletPositions = {}
  if (address) {
    const portfolio = await query.getUserPortfolio({
      walletAddress: address,
      indexer: true,
    })
    positions = portfolio.lendings.reduce<WalletPositions>((acc, lending) => {
      const asset = toAssetSymbol(lending.symbol)
      if (!asset) return acc
      const key = createPositionKey("Scallop", asset)
      acc[key] = (acc[key] ?? 0) + lending.suppliedCoin
      return acc
    }, {})
  }

  return { rows, positions }
}

function buildNaviIncentives(
  rewardCoinTypes: string[] | undefined,
  aprValue: number,
  suffix: "Supply" | "Borrow"
) {
  if (!rewardCoinTypes?.length || aprValue <= 0) return []
  const perToken = aprValue / rewardCoinTypes.length
  return rewardCoinTypes.map((coinType) => ({
    token: `${formatTokenSymbol(coinType)} (${suffix})`,
    apr: perToken,
  }))
}

async function fetchNavi(address?: string | null): Promise<MarketFetchResult> {
  const pools = await getPools({ env: "prod" })
  const selectedPools = pools.reduce<Partial<Record<AssetSymbol, Pool>>>(
    (acc, pool) => {
      const asset = toAssetSymbol(pool.token?.symbol)
      if (!asset) return acc
      const existing = acc[asset]
      if (!existing) {
        acc[asset] = pool
        return acc
      }
      if (pool.isSuiBridge && !existing.isSuiBridge) {
        acc[asset] = pool
      }
      return acc
    },
    {}
  )
  const rows = Object.values(selectedPools)
    .filter((pool): pool is Pool => Boolean(pool))
    .map((pool) => {
      const asset = toAssetSymbol(pool.token?.symbol)
      if (!asset) return null
      const supplyApr = toNumber(pool.currentSupplyRate) / 1e25
      const borrowApr = toNumber(pool.currentBorrowRate) / 1e25
      const utilization =
        pool.totalSupplyAmount && pool.borrowedAmount
          ? (toNumber(pool.borrowedAmount) / toNumber(pool.totalSupplyAmount)) * 100
          : 0
      const supplyIncentiveApr = toNumber(pool.supplyIncentiveApyInfo?.boostedApr)
      const borrowIncentiveApr = toNumber(pool.borrowIncentiveApyInfo?.boostedApr)
      const breakdown = [
        ...buildNaviIncentives(
          pool.supplyIncentiveApyInfo?.rewardCoin,
          supplyIncentiveApr,
          "Supply"
        ),
        ...buildNaviIncentives(
          pool.borrowIncentiveApyInfo?.rewardCoin,
          borrowIncentiveApr,
          "Borrow"
        ),
      ]
      const incentiveApr = sumBreakdown(breakdown)
      const row: MarketRow = {
        asset,
        protocol: "Navi",
        supplyApr,
        borrowApr,
        incentiveApr,
        utilization,
      }
      if (breakdown.length) {
        row.incentiveBreakdown = breakdown
      }
      return row
    })
    .filter((row): row is MarketRow => Boolean(row))

  let positions: WalletPositions = {}
  if (address) {
    const lendingStates = await getLendingState(address, { env: "prod" })
    positions = lendingStates.reduce<WalletPositions>((acc, state) => {
      const asset = toAssetSymbol(state.pool?.token?.symbol)
      if (!asset) return acc
      const key = createPositionKey("Navi", asset)
      const amount = toNumber(state.supplyBalance)
      acc[key] = (acc[key] ?? 0) + amount
      return acc
    }, {})
  }

  return { rows, positions }
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
): Promise<MarketFetchResult> {
  const results = await Promise.allSettled([
    fetchScallop(address),
    fetchNavi(address),
  ])

  const rows = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value.rows : []
  )
  const positions = mergePositions(
    results
      .filter((result): result is PromiseFulfilledResult<MarketFetchResult> => result.status === "fulfilled")
      .map((result) => result.value.positions)
  )

  return { rows, positions }
}
