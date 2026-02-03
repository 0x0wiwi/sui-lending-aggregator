import { getFullnodeUrl, SuiClient } from "@mysten/sui/client"
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
import {
  LENDING_MARKET_ID,
  LENDING_MARKET_TYPE,
  SuilendClient,
} from "@suilend/sdk/client"

import {
  assetTypeAddresses,
  type AssetSymbol,
  type MarketRow,
  type RewardSummaryItem,
} from "@/lib/market-data"
import { createPositionKey, type WalletPositions } from "@/lib/positions"
import { type MarketFetchResult, type MarketOnlyResult, type UserOnlyResult } from "./types"
import BigNumber from "bignumber.js"
import {
  buildSupplyList,
  sumBreakdown,
  toAssetSymbolFromSource,
  toNumber,
} from "./utils"

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
    const isPreferred = (reserve as { coinType?: string }).coinType === preferred
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

export async function fetchSuilendMarket(): Promise<MarketOnlyResult> {
  try {
    const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") })
    const suilendClient = await SuilendClient.initialize(
      LENDING_MARKET_ID,
      LENDING_MARKET_TYPE,
      suiClient
    )
    const { reserveMap, coinMetadataMap, activeRewardCoinTypes } =
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
          .filter((reward): reward is { token: string; apr: number } => Boolean(reward))
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
          .filter((reward): reward is { token: string; apr: number } => Boolean(reward))
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
    return { rows }
  } catch (error) {
    console.error("Suilend market fetch failed:", error)
    return { rows: [] }
  }
}

export async function fetchSuilendUser(
  address?: string | null
): Promise<UserOnlyResult> {
  const positions: WalletPositions = {}
  let rewardSummary: RewardSummaryItem | undefined
  if (!address) return { positions, rewardSummary }
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
    const obligationsResult = await initializeObligations(
      suiClient,
      suilendClient,
      refreshedRawReserves,
      reserveMap,
      address
    )
    obligationsResult.obligations.forEach((obligation) => {
      obligation.deposits.forEach((deposit) => {
        const asset = toAssetSymbolFromSource(
          deposit.reserve.token.symbol,
          deposit.reserve.coinType ?? null
        )
        if (!asset) return
        const key = createPositionKey("Suilend", asset)
        const amount = toNumber(deposit.depositedAmount)
        positions[key] = (positions[key] ?? 0) + amount
      })
    })
    const rewardMapWithClaims = formatRewards(
      reserveMap,
      coinMetadataMap,
      rewardPriceMap,
      obligationsResult.obligations
    )
    const rewardTotals = new Map<string, { token: string; amount: number }>()
    const rewardAtomicTotals = new Map<string, BigNumber>()
    const claimRewards: Array<{
      reserveArrayIndex: bigint
      rewardIndex: bigint
      rewardCoinType: string
      side: Side
    }> = []
    const claimKeys = new Set<string>()
    obligationsResult.obligations.forEach((obligation) => {
      obligation.deposits.forEach((deposit) => {
        const rewards = rewardMapWithClaims[deposit.reserve.coinType]?.[Side.DEPOSIT]
        rewards?.forEach((reward) => {
          const claim = reward.obligationClaims?.[obligation.id]
          const amount = claim ? toNumber(claim.claimableAmount) : 0
          if (amount > 0) {
            const existing = rewardTotals.get(reward.stats.rewardCoinType)
            rewardTotals.set(reward.stats.rewardCoinType, {
              token: reward.stats.symbol,
              amount: (existing?.amount ?? 0) + amount,
            })
            const decimals = reward.stats.mintDecimals ?? 0
            const atomic = claim.claimableAmount
              .multipliedBy(new BigNumber(10).pow(decimals))
              .integerValue(BigNumber.ROUND_FLOOR)
            rewardAtomicTotals.set(
              reward.stats.rewardCoinType,
              (rewardAtomicTotals.get(reward.stats.rewardCoinType) ?? new BigNumber(0)).plus(
                atomic
              )
            )
            const key = `${String(claim.reserveArrayIndex)}-${reward.stats.rewardIndex}-${reward.stats.rewardCoinType}-${reward.stats.side}`
            if (!claimKeys.has(key)) {
              claimKeys.add(key)
              claimRewards.push({
                reserveArrayIndex: claim.reserveArrayIndex,
                rewardIndex: BigInt(reward.stats.rewardIndex),
                rewardCoinType: reward.stats.rewardCoinType,
                side: reward.stats.side,
              })
            }
          }
        })
      })
      obligation.borrows.forEach((borrow) => {
        const rewards = rewardMapWithClaims[borrow.reserve.coinType]?.[Side.BORROW]
        rewards?.forEach((reward) => {
          const claim = reward.obligationClaims?.[obligation.id]
          const amount = claim ? toNumber(claim.claimableAmount) : 0
          if (amount > 0) {
            const existing = rewardTotals.get(reward.stats.rewardCoinType)
            rewardTotals.set(reward.stats.rewardCoinType, {
              token: reward.stats.symbol,
              amount: (existing?.amount ?? 0) + amount,
            })
            const decimals = reward.stats.mintDecimals ?? 0
            const atomic = claim.claimableAmount
              .multipliedBy(new BigNumber(10).pow(decimals))
              .integerValue(BigNumber.ROUND_FLOOR)
            rewardAtomicTotals.set(
              reward.stats.rewardCoinType,
              (rewardAtomicTotals.get(reward.stats.rewardCoinType) ?? new BigNumber(0)).plus(
                atomic
              )
            )
            const key = `${String(claim.reserveArrayIndex)}-${reward.stats.rewardIndex}-${reward.stats.rewardCoinType}-${reward.stats.side}`
            if (!claimKeys.has(key)) {
              claimKeys.add(key)
              claimRewards.push({
                reserveArrayIndex: claim.reserveArrayIndex,
                rewardIndex: BigInt(reward.stats.rewardIndex),
                rewardCoinType: reward.stats.rewardCoinType,
                side: reward.stats.side,
              })
            }
          }
        })
      })
    })
    rewardSummary = {
      protocol: "Suilend",
      supplies: buildSupplyList(positions, "Suilend"),
      rewards: Array.from(rewardTotals.entries())
        .map(([coinType, reward]) => ({
          token: reward.token,
          amount: reward.amount,
          coinType,
        }))
        .filter((reward) => reward.amount > 0),
      claimMeta: claimRewards.length
        ? {
            suilend: {
              rewards: claimRewards,
              swapInputs: Array.from(rewardAtomicTotals.entries())
                .map(([coinType, amount]) => ({
                  coinType,
                  amountAtomic: amount.toFixed(0),
                }))
                .filter((input) => input.amountAtomic !== "0"),
            },
          }
        : undefined,
    }
  } catch (error) {
    console.error("Suilend user fetch failed:", error)
  }
  return { positions, rewardSummary }
}

export async function fetchSuilend(
  address?: string | null
): Promise<MarketFetchResult> {
  const [market, user] = await Promise.all([
    fetchSuilendMarket(),
    fetchSuilendUser(address),
  ])
  return {
    rows: market.rows,
    positions: user.positions,
    rewardSummary: user.rewardSummary,
  }
}
