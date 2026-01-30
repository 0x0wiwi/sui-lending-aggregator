import * as React from "react"

import { getMockMarketRows, type MarketRow } from "@/lib/market-data"

type MarketDataState = {
  rows: MarketRow[]
  updatedAt: Date | null
  refresh: () => void
}

export function useMarketData(): MarketDataState {
  const [rows, setRows] = React.useState<MarketRow[]>(() =>
    getMockMarketRows()
  )
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(new Date())

  const refresh = React.useCallback(() => {
    setRows(getMockMarketRows())
    setUpdatedAt(new Date())
  }, [])

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      refresh()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return { rows, updatedAt, refresh }
}
