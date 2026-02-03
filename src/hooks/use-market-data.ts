import * as React from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"

import {
  supportedProtocols,
  type Protocol,
  type MarketRow,
  type RewardSummaryItem,
} from "@/lib/market-data"
import type { MarketFetchResult } from "@/lib/market-fetch/types"
import { buildSupplyList } from "@/lib/market-fetch/utils"
import { type WalletPositions } from "@/lib/positions"

type MarketDataState = {
  rows: MarketRow[]
  positions: WalletPositions
  rewardSummary: RewardSummaryItem[]
  updatedAt: Date | null
  refresh: () => void
  isLoading: boolean
  marketErrorProtocols: Protocol[]
  userErrorProtocols: Protocol[]
}

export function useMarketData(address?: string | null): MarketDataState {
  const [rows, setRows] = React.useState<MarketRow[]>([])
  const [positions, setPositions] = React.useState<WalletPositions>({})
  const [rewardSummary, setRewardSummary] = React.useState<RewardSummaryItem[]>([])
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null)
  const queryClient = useQueryClient()
  const lastRowsRef = React.useRef<MarketRow[]>([])
  const positionsByProtocolRef = React.useRef<Record<Protocol, WalletPositions>>({
    Scallop: {},
    Navi: {},
    Suilend: {},
    AlphaLend: {},
  })
  const summaryByProtocolRef = React.useRef<
    Record<Protocol, RewardSummaryItem | null>
  >({
    Scallop: null,
    Navi: null,
    Suilend: null,
    AlphaLend: null,
  })
  const lastMarketSignatureRef = React.useRef<string>("")
  const lastUserSignatureRef = React.useRef<string>("")

  const mergeRows = React.useCallback((nextRows: MarketRow[]) => {
    const nextByKey = new Map(
      nextRows.map((row) => [`${row.protocol}-${row.asset}`, row])
    )
    const hasProtocol = supportedProtocols.reduce<Record<string, boolean>>(
      (acc, protocol) => {
        acc[protocol] = nextRows.some((row) => row.protocol === protocol)
        return acc
      },
      {}
    )
    lastRowsRef.current.forEach((row) => {
      if (!hasProtocol[row.protocol]) {
        nextByKey.set(`${row.protocol}-${row.asset}`, row)
      }
    })
    const merged = Array.from(nextByKey.values())
    lastRowsRef.current = merged
    return merged
  }, [])

  const roundValue = React.useCallback((value: number, digits: number) => {
    const base = 10 ** digits
    return Math.round(value * base) / base
  }, [])

  const buildMarketSignature = React.useCallback(
    (nextRows: MarketRow[]) => {
      const lines = nextRows
        .map((row) => {
          const key = `${row.protocol}-${row.asset}`
          const values = [
            roundValue(row.supplyApr, 6),
            roundValue(row.borrowApr, 6),
            roundValue(row.utilization, 6),
            roundValue(row.supplyBaseApr, 6),
            roundValue(row.borrowBaseApr, 6),
            roundValue(row.supplyIncentiveApr, 6),
            roundValue(row.borrowIncentiveApr, 6),
          ]
          return `${key}:${values.join(",")}`
        })
        .sort()
      return lines.join("|")
    },
    [roundValue]
  )

  const buildUserSignature = React.useCallback(
    (nextPositions: WalletPositions) => {
      const positionLines = Object.entries(nextPositions)
        .map(([key, amount]) => `${key}:${roundValue(amount, 8)}`)
        .sort()
      const rewardLines = supportedProtocols.flatMap((protocol) => {
        const summary = summaryByProtocolRef.current[protocol]
        if (!summary) return []
        return summary.rewards
          .map((reward) => {
            const key = reward.coinType ?? reward.token
            return `${protocol}:${key}:${roundValue(reward.amount, 8)}`
          })
          .sort()
      })
      return `${positionLines.join("|")}#${rewardLines.join("|")}`
    },
    [roundValue]
  )

  const mergePositions = React.useCallback((all: WalletPositions[]) => {
    return all.reduce<WalletPositions>((acc, positions) => {
      Object.entries(positions).forEach(([key, value]) => {
        if (typeof value !== "number") return
        const typedKey = key as keyof WalletPositions
        acc[typedKey] = (acc[typedKey] ?? 0) + value
      })
      return acc
    }, {})
  }, [])

  const buildSummary = React.useCallback((nextPositions: WalletPositions) => {
    const summaryMap = new Map<Protocol, RewardSummaryItem>()
    supportedProtocols.forEach((protocol) => {
      summaryMap.set(protocol, {
        protocol,
        supplies: buildSupplyList(nextPositions, protocol),
        rewards: [],
      })
    })
    supportedProtocols.forEach((protocol) => {
      const summary = summaryByProtocolRef.current[protocol]
      if (!summary) return
      const existing = summaryMap.get(protocol)
      summaryMap.set(protocol, {
        protocol,
        supplies: summary.supplies.length ? summary.supplies : existing?.supplies ?? [],
        rewards: summary.rewards,
        claimMeta: summary.claimMeta,
      })
    })
    return Array.from(summaryMap.values())
  }, [])

  const fetchMarketOnly = React.useCallback(
    async (protocol: Protocol): Promise<MarketFetchResult> => {
      if (protocol === "Scallop") {
        const module = await import("@/lib/market-fetch/scallop")
        return { rows: (await module.fetchScallopMarket()).rows, positions: {} }
      }
      if (protocol === "Navi") {
        const module = await import("@/lib/market-fetch/navi")
        return { rows: (await module.fetchNaviMarket()).rows, positions: {} }
      }
      if (protocol === "Suilend") {
        const module = await import("@/lib/market-fetch/suilend")
        return { rows: (await module.fetchSuilendMarket()).rows, positions: {} }
      }
      const module = await import("@/lib/market-fetch/alphalend")
      return { rows: (await module.fetchAlphaLendMarket()).rows, positions: {} }
    },
    []
  )

  const fetchUserOnly = React.useCallback(
    async (protocol: Protocol): Promise<MarketFetchResult> => {
      if (protocol === "Scallop") {
        const module = await import("@/lib/market-fetch/scallop")
        const user = await module.fetchScallopUser(address)
        return { rows: [], positions: user.positions, rewardSummary: user.rewardSummary }
      }
      if (protocol === "Navi") {
        const module = await import("@/lib/market-fetch/navi")
        const user = await module.fetchNaviUser(address)
        return { rows: [], positions: user.positions, rewardSummary: user.rewardSummary }
      }
      if (protocol === "Suilend") {
        const module = await import("@/lib/market-fetch/suilend")
        const user = await module.fetchSuilendUser(address)
        return { rows: [], positions: user.positions, rewardSummary: user.rewardSummary }
      }
      const module = await import("@/lib/market-fetch/alphalend")
      const user = await module.fetchAlphaLendUser(address)
      return { rows: [], positions: user.positions, rewardSummary: user.rewardSummary }
    },
    [address]
  )

  const marketIntervals = React.useMemo(
    () => ({
      Scallop: 5,
      Navi: 7,
      Suilend: 11,
      AlphaLend: 13,
    }),
    []
  )
  const marketQueries = useQueries({
    queries: supportedProtocols.map((protocol) => ({
      queryKey: ["market", protocol],
      queryFn: () => fetchMarketOnly(protocol),
      refetchInterval: marketIntervals[protocol] * 1000,
      staleTime: marketIntervals[protocol] * 1000,
      refetchIntervalInBackground: false,
    })),
  })
  const userQueries = useQueries({
    queries: supportedProtocols.map((protocol) => ({
      queryKey: ["user", protocol, address],
      queryFn: () => fetchUserOnly(protocol),
      enabled: Boolean(address),
      refetchInterval: 15000,
      staleTime: 15000,
      refetchIntervalInBackground: false,
    })),
  })
  const isLoading =
    marketQueries.some((query) => query.isLoading || query.isFetching)
    || userQueries.some((query) => query.isLoading || query.isFetching)
  const marketErrorProtocols = supportedProtocols.filter((_, index) =>
    Boolean(marketQueries[index]?.error)
  )
  const userErrorProtocols = supportedProtocols.filter((_, index) =>
    Boolean(userQueries[index]?.error)
  )

  React.useEffect(() => {
    const mergedRows: MarketRow[] = []
    marketQueries.forEach((query) => {
      if (!query.data?.rows?.length) return
      mergedRows.push(...query.data.rows)
    })
    if (!mergedRows.length) return
    const nextRows = mergeRows(mergedRows)
    const signature = buildMarketSignature(nextRows)
    if (signature !== lastMarketSignatureRef.current) {
      lastMarketSignatureRef.current = signature
      setRows(nextRows)
      setUpdatedAt(new Date())
    }
  }, [buildMarketSignature, marketQueries, mergeRows])

  React.useEffect(() => {
    let hasUserData = false
    userQueries.forEach((query, index) => {
      if (!query.data) return
      hasUserData = true
      const protocol = supportedProtocols[index]
      positionsByProtocolRef.current[protocol] = query.data.positions
      if (query.data.rewardSummary) {
        summaryByProtocolRef.current[protocol] = query.data.rewardSummary
      }
    })
    if (!hasUserData) return
    const nextPositions = mergePositions(
      Object.values(positionsByProtocolRef.current)
    )
    const signature = buildUserSignature(nextPositions)
    if (signature !== lastUserSignatureRef.current) {
      lastUserSignatureRef.current = signature
      setPositions(nextPositions)
      setRewardSummary(buildSummary(nextPositions))
      setUpdatedAt(new Date())
    }
  }, [buildSummary, buildUserSignature, mergePositions, userQueries])

  const refreshAll = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["market"] })
    queryClient.invalidateQueries({ queryKey: ["user"] })
  }, [queryClient])

  React.useEffect(() => {
    refreshAll()
  }, [refreshAll])

  return {
    rows,
    positions,
    rewardSummary,
    updatedAt,
    refresh: refreshAll,
    isLoading,
    marketErrorProtocols,
    userErrorProtocols,
  }
}
