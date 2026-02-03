import * as React from "react"
import type { SortDirection, SortKey } from "@/components/MarketTable"

type FilterState = {
  assets: string[]
  protocols: string[]
  onlyIncentive: boolean
  onlyPosition: boolean
}

type ViewMode = "mixed" | "byAsset" | "byProtocol"

type UseMarketFiltersArgs = {
  defaultFilters: FilterState
  filterStorageKey: string
  viewStorageKey: string
  sortStorageKey: string
}

export function useMarketFilters({
  defaultFilters,
  filterStorageKey,
  viewStorageKey,
  sortStorageKey,
}: UseMarketFiltersArgs) {
  const [filters, setFilters] = React.useState<FilterState>(() => {
    if (typeof window === "undefined") return defaultFilters
    const stored = window.localStorage.getItem(filterStorageKey)
    if (!stored) return defaultFilters
    try {
      const parsed = JSON.parse(stored) as Partial<FilterState>
      return {
        ...defaultFilters,
        ...parsed,
      }
    } catch {
      return defaultFilters
    }
  })
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    if (typeof window === "undefined") return "mixed"
    const stored = window.localStorage.getItem(viewStorageKey)
    return stored === "byAsset" || stored === "byProtocol" ? stored : "mixed"
  })
  const [sortKey, setSortKey] = React.useState<SortKey>(() => {
    if (typeof window === "undefined") return "asset"
    const stored = window.localStorage.getItem(sortStorageKey)
    if (!stored) return "asset"
    try {
      const parsed = JSON.parse(stored) as { key?: SortKey }
      return parsed.key ?? "asset"
    } catch {
      return "asset"
    }
  })
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(() => {
    if (typeof window === "undefined") return "asc"
    const stored = window.localStorage.getItem(sortStorageKey)
    if (!stored) return "asc"
    try {
      const parsed = JSON.parse(stored) as { direction?: SortDirection }
      return parsed.direction ?? "asc"
    } catch {
      return "asc"
    }
  })

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(filterStorageKey, JSON.stringify(filters))
  }, [filters, filterStorageKey])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(viewStorageKey, viewMode)
  }, [viewMode, viewStorageKey])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      sortStorageKey,
      JSON.stringify({ key: sortKey, direction: sortDirection })
    )
  }, [sortKey, sortDirection, sortStorageKey])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDirection("desc")
  }

  const handleToggleAsset = (asset: string) => {
    setFilters((prev) => {
      const exists = prev.assets.includes(asset)
      return {
        ...prev,
        assets: exists
          ? prev.assets.filter((item) => item !== asset)
          : [...prev.assets, asset],
      }
    })
  }

  const handleToggleProtocol = (protocol: string) => {
    setFilters((prev) => {
      const exists = prev.protocols.includes(protocol)
      return {
        ...prev,
        protocols: exists
          ? prev.protocols.filter((item) => item !== protocol)
          : [...prev.protocols, protocol],
      }
    })
  }

  const handleToggleIncentive = () => {
    setFilters((prev) => ({
      ...prev,
      onlyIncentive: !prev.onlyIncentive,
    }))
  }

  const handleTogglePosition = () => {
    setFilters((prev) => ({
      ...prev,
      onlyPosition: !prev.onlyPosition,
    }))
  }

  const handleClearFilters = () => {
    setFilters(defaultFilters)
    setViewMode("mixed")
  }

  return {
    filters,
    viewMode,
    sortKey,
    sortDirection,
    setViewMode,
    handleSort,
    handleToggleAsset,
    handleToggleProtocol,
    handleToggleIncentive,
    handleTogglePosition,
    handleClearFilters,
  }
}
