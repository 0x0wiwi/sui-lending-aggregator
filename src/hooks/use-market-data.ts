import * as React from "react"

import { type MarketRow } from "@/lib/market-data"
import { fetchMarketSnapshot } from "@/lib/market-fetch"
import { type WalletPositions } from "@/lib/positions"

type MarketDataState = {
  rows: MarketRow[]
  positions: WalletPositions
  updatedAt: Date | null
  refresh: () => void
  isLoading: boolean
}

export function useMarketData(address?: string | null): MarketDataState {
  const [rows, setRows] = React.useState<MarketRow[]>([])
  const [positions, setPositions] = React.useState<WalletPositions>({})
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const isRefreshing = React.useRef(false)

  const refresh = React.useCallback(() => {
    if (isRefreshing.current) return
    isRefreshing.current = true
    setIsLoading(true)
    fetchMarketSnapshot(address)
      .then((snapshot) => {
        setRows(snapshot.rows)
        setPositions(snapshot.positions)
        setUpdatedAt(new Date())
      })
      .finally(() => {
        isRefreshing.current = false
        setIsLoading(false)
      })
  }, [address])

  React.useEffect(() => {
    refresh()
    const timer = window.setInterval(() => {
      refresh()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return { rows, positions, updatedAt, refresh, isLoading }
}
