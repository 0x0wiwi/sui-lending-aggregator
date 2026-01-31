import * as React from "react"
import { RefreshCcwIcon } from "lucide-react"
import { useCurrentAccount } from "@mysten/dapp-kit"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FiltersBar } from "@/components/FiltersBar"
import { MarketTable, type SortDirection, type SortKey } from "@/components/MarketTable"
import { useMarketData } from "@/hooks/use-market-data"
import { type MarketRow } from "@/lib/market-data"

type FilterState = {
  assets: string[]
  protocols: string[]
  onlyIncentive: boolean
  onlyPosition: boolean
}

const defaultFilters: FilterState = {
  assets: [],
  protocols: [],
  onlyIncentive: false,
  onlyPosition: false,
}

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
  const { rows, updatedAt, refresh, positions, isLoading } = useMarketData(
    account?.address
  )

  const [filters, setFilters] = React.useState<FilterState>(defaultFilters)
  const [sortKey, setSortKey] = React.useState<SortKey>("supplyApr")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")

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
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <FiltersBar
              selectedAssets={filters.assets}
              selectedProtocols={filters.protocols}
              onlyIncentive={filters.onlyIncentive}
              onlyPosition={filters.onlyPosition}
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
            />
          </div>

          {sortedRows.length ? (
            <MarketTable
              rows={sortedRows}
              positions={positions}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          ) : (
            <div className="border border-dashed p-6 text-center text-xs text-muted-foreground">
              {filters.onlyPosition && !account?.address
                ? "Connect a wallet to view positions."
                : "No results. Adjust filters to see more markets."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
