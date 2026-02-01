import { supportedProtocols, type RewardSummaryItem } from "@/lib/market-data"
import type { WalletPositions } from "@/lib/positions"
import { fetchAlphaLend } from "./alphalend"
import { fetchNavi } from "./navi"
import { fetchScallop } from "./scallop"
import { fetchSuilend } from "./suilend"
import type { MarketFetchResult, MarketSnapshot } from "./types"
import { buildSupplyList } from "./utils"

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
      .filter(
        (result): result is PromiseFulfilledResult<MarketFetchResult> =>
          result.status === "fulfilled"
      )
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
      claimMeta: summary.claimMeta,
    })
  })

  return {
    rows,
    positions,
    rewardSummary: Array.from(summaryMap.values()),
  }
}
