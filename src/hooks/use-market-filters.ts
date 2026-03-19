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
  availableAssets: string[]
  filterStorageKey: string
  viewStorageKey: string
  sortStorageKey: string
}

type StateUpdater<T> = T | ((previous: T) => T)
type SortState = {
  key: SortKey
  direction: SortDirection
}

const defaultSortState: SortState = {
  key: "asset",
  direction: "asc",
}

function resolveNextState<T>(updater: StateUpdater<T>, previous: T) {
  return typeof updater === "function"
    ? (updater as (previous: T) => T)(previous)
    : updater
}

export function useMarketFilters({
  defaultFilters,
  availableAssets,
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
  const [sortState, setSortState] = React.useState<SortState>(() => {
    if (typeof window === "undefined") return defaultSortState
    const stored = window.localStorage.getItem(sortStorageKey)
    if (!stored) return defaultSortState
    try {
      const parsed = JSON.parse(stored) as {
        key?: SortKey
        direction?: SortDirection
      }
      return {
        key: parsed.key ?? defaultSortState.key,
        direction: parsed.direction ?? defaultSortState.direction,
      }
    } catch {
      return defaultSortState
    }
  })
  const sortKey = sortState.key
  const sortDirection = sortState.direction
  const filtersRef = React.useRef(filters)
  const viewModeRef = React.useRef(viewMode)
  const sortStateRef = React.useRef(sortState)

  React.useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  React.useEffect(() => {
    viewModeRef.current = viewMode
  }, [viewMode])

  React.useEffect(() => {
    sortStateRef.current = sortState
  }, [sortState])

  const updateFilters = React.useCallback((updater: StateUpdater<FilterState>) => {
    const next = resolveNextState(updater, filtersRef.current)
    filtersRef.current = next
    setFilters(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(filterStorageKey, JSON.stringify(next))
    }
  }, [filterStorageKey])

  const updateViewMode = React.useCallback((updater: StateUpdater<ViewMode>) => {
    const next = resolveNextState(updater, viewModeRef.current)
    viewModeRef.current = next
    setViewMode(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(viewStorageKey, next)
    }
  }, [viewStorageKey])

  const updateSortState = React.useCallback((updater: StateUpdater<SortState>) => {
    const next = resolveNextState(updater, sortStateRef.current)
    sortStateRef.current = next
    setSortState(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(sortStorageKey, JSON.stringify(next))
    }
  }, [sortStorageKey])

  React.useEffect(() => {
    if (!availableAssets.length) return
    const availableAssetSet = new Set(availableAssets)
    updateFilters((prev) => {
      const nextAssets = prev.assets.filter((asset) => availableAssetSet.has(asset))
      if (nextAssets.length === prev.assets.length) {
        return prev
      }
      return {
        ...prev,
        assets: nextAssets,
      }
    })
  }, [availableAssets, updateFilters])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      updateSortState((prev) => ({
        ...prev,
        direction: prev.direction === "asc" ? "desc" : "asc",
      }))
      return
    }
    updateSortState({
      key,
      direction: "desc",
    })
  }

  const handleToggleAsset = (asset: string) => {
    updateFilters((prev) => {
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
    updateFilters((prev) => {
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
    updateFilters((prev) => ({
      ...prev,
      onlyIncentive: !prev.onlyIncentive,
    }))
  }

  const handleTogglePosition = () => {
    updateFilters((prev) => ({
      ...prev,
      onlyPosition: !prev.onlyPosition,
    }))
  }

  const handleClearFilters = () => {
    updateFilters(defaultFilters)
    updateViewMode("mixed")
  }

  return {
    filters,
    viewMode,
    sortKey,
    sortDirection,
    setViewMode: updateViewMode,
    handleSort,
    handleToggleAsset,
    handleToggleProtocol,
    handleToggleIncentive,
    handleTogglePosition,
    handleClearFilters,
  }
}
