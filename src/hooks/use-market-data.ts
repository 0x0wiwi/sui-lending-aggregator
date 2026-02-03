import * as React from "react"

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
}

export function useMarketData(address?: string | null): MarketDataState {
  const [rows, setRows] = React.useState<MarketRow[]>([])
  const [positions, setPositions] = React.useState<WalletPositions>({})
  const [rewardSummary, setRewardSummary] = React.useState<RewardSummaryItem[]>([])
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const isRefreshing = React.useRef(false)
  const marketRefreshing = React.useRef<Record<Protocol, boolean>>({
    Scallop: false,
    Navi: false,
    Suilend: false,
    AlphaLend: false,
  })
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

  const refreshMarketProtocol = React.useCallback(
    async (protocol: Protocol) => {
      if (marketRefreshing.current[protocol]) return
      marketRefreshing.current[protocol] = true
      try {
        const snapshot = await fetchMarketOnly(protocol)
        setRows(mergeRows(snapshot.rows))
        setUpdatedAt(new Date())
      } finally {
        marketRefreshing.current[protocol] = false
      }
    },
    [fetchMarketOnly, mergeRows]
  )

  const refreshAllMarkets = React.useCallback(() => {
    return Promise.allSettled(
      supportedProtocols.map((protocol) => fetchMarketOnly(protocol))
    ).then((results) => {
      const mergedRows: MarketRow[] = []
      results.forEach((result) => {
        if (result.status !== "fulfilled") return
        mergedRows.push(...result.value.rows)
      })
      setRows(mergeRows(mergedRows))
      setUpdatedAt(new Date())
    })
  }, [fetchMarketOnly, mergeRows])

  const refreshAllUsers = React.useCallback(() => {
    return Promise.allSettled(
      supportedProtocols.map((protocol) => fetchUserOnly(protocol))
    ).then((results) => {
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return
        const protocol = supportedProtocols[index]
        positionsByProtocolRef.current[protocol] = result.value.positions
        if (result.value.rewardSummary) {
          summaryByProtocolRef.current[protocol] = result.value.rewardSummary
        }
      })
      const nextPositions = mergePositions(
        Object.values(positionsByProtocolRef.current)
      )
      setPositions(nextPositions)
      setRewardSummary(buildSummary(nextPositions))
      setUpdatedAt(new Date())
    })
  }, [buildSummary, fetchUserOnly, mergePositions])

  const refreshAll = React.useCallback(() => {
    if (isRefreshing.current) return
    isRefreshing.current = true
    setIsLoading(true)
    Promise.all([refreshAllMarkets(), refreshAllUsers()])
      .finally(() => {
        isRefreshing.current = false
        setIsLoading(false)
      })
  }, [refreshAllMarkets, refreshAllUsers])

  React.useEffect(() => {
    refreshAll()
    const intervals: number[] = []
    const scheduleMarket = (protocol: Protocol, intervalSeconds: number) => {
      const intervalId = window.setInterval(() => {
        refreshMarketProtocol(protocol)
      }, intervalSeconds * 1000)
      intervals.push(intervalId)
    }
    scheduleMarket("Scallop", 5)
    scheduleMarket("Navi", 7)
    scheduleMarket("Suilend", 11)
    scheduleMarket("AlphaLend", 13)
    const userInterval = window.setInterval(() => {
      refreshAllUsers()
    }, 15000)
    intervals.push(userInterval)
    return () => {
      intervals.forEach((id) => window.clearInterval(id))
    }
  }, [refreshAll, refreshAllUsers, refreshMarketProtocol])

  return { rows, positions, rewardSummary, updatedAt, refresh: refreshAll, isLoading }
}
