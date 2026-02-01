import * as React from "react"

import {
  supportedProtocols,
  type MarketRow,
  type RewardSummaryItem,
} from "@/lib/market-data"
import { fetchMarketSnapshot } from "@/lib/market-fetch"
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
  const lastRowsRef = React.useRef<MarketRow[]>([])

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

  const refresh = React.useCallback(() => {
    if (isRefreshing.current) return
    isRefreshing.current = true
    setIsLoading(true)
    fetchMarketSnapshot(address)
      .then((snapshot) => {
        setRows(mergeRows(snapshot.rows))
        setPositions(snapshot.positions)
        setRewardSummary(snapshot.rewardSummary)
        setUpdatedAt(new Date())
      })
      .finally(() => {
        isRefreshing.current = false
        setIsLoading(false)
      })
  }, [address, mergeRows])

  React.useEffect(() => {
    refresh()
    const timer = window.setInterval(() => {
      refresh()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return { rows, positions, rewardSummary, updatedAt, refresh, isLoading }
}
