import * as React from "react"
import { RefreshCcwIcon } from "lucide-react"
import { useCurrentAccount } from "@mysten/dapp-kit"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarketToolbar } from "@/components/MarketToolbar"
import { MarketTable, type SortDirection, type SortKey } from "@/components/MarketTable"
import { RewardSummaryCard } from "@/components/RewardSummaryCard"
import { useClaimRewards } from "@/hooks/use-claim-rewards"
import { useCoinDecimals } from "@/hooks/use-coin-decimals"
import { useMarketData } from "@/hooks/use-market-data"
import {
  assetTypeAddresses,
  supportedAssets,
  supportedProtocols,
  type MarketRow,
} from "@/lib/market-data"

type FilterState = {
  assets: string[]
  protocols: string[]
  onlyIncentive: boolean
  onlyPosition: boolean
}

type ViewMode = "mixed" | "byAsset" | "byProtocol"

const defaultFilters: FilterState = {
  assets: [],
  protocols: [],
  onlyIncentive: false,
  onlyPosition: false,
}
const filterStorageKey = "lending-market-filters"
const viewStorageKey = "lending-market-view"
const sortStorageKey = "lending-market-sort"
const swapOptions = [
  {
    label: "SUI",
    coinType: assetTypeAddresses.SUI,
  },
  {
    label: "USDC",
    coinType: assetTypeAddresses.USDC,
  },
  {
    label: "USDT",
    coinType: assetTypeAddresses.USDT,
  },
]
const swapSlippageLabel = "0.1%"

function sortRows(
  rows: MarketRow[],
  sortKey: SortKey,
  direction: SortDirection,
  positions: Record<string, number>
) {
  const multiplier = direction === "asc" ? 1 : -1
  const sorted = [...rows].sort((a, b) => {
    if (sortKey === "asset") {
      return a.asset.localeCompare(b.asset) * multiplier
    }
    if (sortKey === "protocol") {
      return a.protocol.localeCompare(b.protocol) * multiplier
    }
    if (sortKey === "yourSupply") {
      const aValue = positions[`${a.protocol}-${a.asset}`] ?? 0
      const bValue = positions[`${b.protocol}-${b.asset}`] ?? 0
      return (aValue - bValue) * multiplier
    }
    const aValue = a[sortKey]
    const bValue = b[sortKey]
    return (aValue - bValue) * multiplier
  })
  return sorted
}

function formatTimestamp(value: Date | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value)
}

export function MarketDashboard() {
  const account = useCurrentAccount()
  const previewAddress = React.useMemo(() => {
    if (typeof window === "undefined") return null
    const value = new URLSearchParams(window.location.search).get("address")
    return value && value.startsWith("0x") ? value : null
  }, [])
  const displayAddress = previewAddress ?? account?.address
  const showClaimActions = Boolean(account?.address) && !previewAddress
  const { rows, updatedAt, refresh, positions, rewardSummary, isLoading } = useMarketData(
    displayAddress
  )

  const [filters, setFilters] = React.useState<FilterState>(() => {
    if (typeof window === "undefined") return defaultFilters
    const stored = window.localStorage.getItem(filterStorageKey)
    if (!stored) return defaultFilters
    try {
      const parsed = JSON.parse(stored) as FilterState
      return {
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        protocols: Array.isArray(parsed.protocols) ? parsed.protocols : [],
        onlyIncentive: Boolean(parsed.onlyIncentive),
        onlyPosition: Boolean(parsed.onlyPosition),
      }
    } catch {
      return defaultFilters
    }
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
  const [swapTarget, setSwapTarget] = React.useState<string>(
    assetTypeAddresses.USDC
  )
  const swapTargetLabel =
    swapOptions.find((option) => option.coinType === swapTarget)?.label ?? "USDC"
  const swapTargetOptions = React.useMemo(
    () => swapOptions.map(({ label, coinType }) => ({ label, coinType })),
    []
  )
  const swapCoinTypes = React.useMemo(
    () => swapOptions.map((option) => option.coinType),
    []
  )
  const decimalsMap = useCoinDecimals(swapCoinTypes)
  const swapTargetDecimals = decimalsMap[swapTarget] ?? null
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    if (typeof window === "undefined") return "mixed"
    const stored = window.localStorage.getItem(viewStorageKey)
    return stored === "byAsset" || stored === "byProtocol" ? stored : "mixed"
  })

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(filterStorageKey, JSON.stringify(filters))
  }, [filters])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(viewStorageKey, viewMode)
  }, [viewMode])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      sortStorageKey,
      JSON.stringify({ key: sortKey, direction: sortDirection })
    )
  }, [sortKey, sortDirection])

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

  const handleClearFilters = () => {
    setFilters(defaultFilters)
    setViewMode("mixed")
  }

  const filteredRows = rows
    .filter((row) =>
      filters.assets.length ? filters.assets.includes(row.asset) : true
    )
    .filter((row) =>
      filters.protocols.length ? filters.protocols.includes(row.protocol) : true
    )
    .filter((row) =>
      filters.onlyIncentive
        ? row.supplyIncentiveApr > 0 || row.borrowIncentiveApr > 0
        : true
    )
    .filter((row) => {
      if (!filters.onlyPosition) return true
      const position = positions[`${row.protocol}-${row.asset}`] ?? 0
      return position > 0
    })

  const sortedRows = sortRows(filteredRows, sortKey, sortDirection, positions)
  const protocolGroups = supportedProtocols.filter((protocol) =>
    filteredRows.some((row) => row.protocol === protocol)
  )
  const assetGroups = supportedAssets.filter((asset) =>
    filteredRows.some((row) => row.asset === asset)
  )
  const summaryRows = supportedProtocols
    .map((protocol) => rewardSummary.find((item) => item.protocol === protocol))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const totalSupplies = summaryRows.reduce<Record<string, number>>(
    (acc, item) => {
      item.supplies.forEach((supply) => {
        acc[supply.asset] = (acc[supply.asset] ?? 0) + supply.amount
      })
      return acc
    },
    {}
  )
  const totalRewards = summaryRows.reduce<Record<string, number>>((acc, item) => {
    item.rewards.forEach((reward) => {
      acc[reward.token] = (acc[reward.token] ?? 0) + reward.amount
    })
    return acc
  }, {})
  const totalSupplyList = Object.entries(totalSupplies).map(([asset, amount]) => ({
    asset,
    amount,
  }))
  const totalRewardList = Object.entries(totalRewards).map(([token, amount]) => ({
    token,
    amount,
  }))

  const {
    claimError,
    claimingProtocol,
    handleClaimAll,
    handleClaimProtocol,
    hasAnyClaim,
    isProtocolClaimSupported,
    swapEstimateLabel,
  } = useClaimRewards({
    summaryRows,
    showClaimActions,
    onRefresh: refresh,
    swapTargetCoinType: swapTarget,
    swapTargetDecimals,
    swapTargetSymbol: swapTargetLabel,
  })

  return (
    <div className="grid gap-6">
      <Card className="overflow-visible">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Lending Markets</CardTitle>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Last updated: {formatTimestamp(updatedAt)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isLoading}
              >
                <RefreshCcwIcon />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 overflow-visible">
          <RewardSummaryCard
            displayAddress={displayAddress}
            summaryRows={summaryRows}
            totalSupplyList={totalSupplyList}
            totalRewardList={totalRewardList}
            showClaimActions={showClaimActions}
            claimError={claimError}
            claimingProtocol={claimingProtocol}
            hasAnyClaim={hasAnyClaim}
            onClaimProtocol={handleClaimProtocol}
            onClaimAll={handleClaimAll}
            isProtocolClaimSupported={isProtocolClaimSupported}
            swapTargetCoinType={swapTarget}
            swapTargetOptions={swapTargetOptions}
            onSwapTargetChange={setSwapTarget}
            slippageLabel={swapSlippageLabel}
            swapEstimateLabel={swapEstimateLabel}
          />
          <MarketToolbar
            selectedAssets={filters.assets}
            selectedProtocols={filters.protocols}
            onlyIncentive={filters.onlyIncentive}
            onlyPosition={filters.onlyPosition}
            viewMode={viewMode}
            onToggleAsset={handleToggleAsset}
            onToggleProtocol={handleToggleProtocol}
            onToggleIncentive={() =>
              setFilters((prev) => ({
                ...prev,
                onlyIncentive: !prev.onlyIncentive,
              }))
            }
            onTogglePosition={() =>
              setFilters((prev) => ({
                ...prev,
                onlyPosition: !prev.onlyPosition,
              }))
            }
            onChangeView={setViewMode}
            onClearFilters={handleClearFilters}
          />

          {sortedRows.length ? (
            <div className="grid gap-6">
              {viewMode === "mixed" && (
                <MarketTable
                  rows={sortedRows}
                  positions={positions}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              )}

              {viewMode === "byProtocol" && (
                <div className="grid gap-3">
                  {protocolGroups.map((protocol) => {
                    const rows = sortRows(
                      filteredRows.filter((row) => row.protocol === protocol),
                      sortKey,
                      sortDirection,
                      positions
                    )
                    return (
                      <Card key={protocol} size="sm" className="overflow-visible">
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">{protocol}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 overflow-visible">
                          <MarketTable
                            rows={rows}
                            positions={positions}
                            sortKey={sortKey}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                          />
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              {viewMode === "byAsset" && (
                <div className="grid gap-3">
                  {assetGroups.map((asset) => {
                    const rows = sortRows(
                      filteredRows.filter((row) => row.asset === asset),
                      sortKey,
                      sortDirection,
                      positions
                    )
                    return (
                      <Card key={asset} size="sm" className="overflow-visible">
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">{asset}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 overflow-visible">
                          <MarketTable
                            rows={rows}
                            positions={positions}
                            sortKey={sortKey}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                          />
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed p-6 text-center text-xs text-muted-foreground">
              {filters.onlyPosition && !displayAddress
                ? "Connect a wallet to view positions."
                : "No results. Adjust filters to see more markets."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
