import * as React from "react"
import { RefreshCcwIcon } from "lucide-react"
import { useCurrentAccount } from "@mysten/dapp-kit"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FiltersBar } from "@/components/FiltersBar"
import { MarketTable, type SortDirection, type SortKey } from "@/components/MarketTable"
import { useMarketData } from "@/hooks/use-market-data"
import { supportedAssets, supportedProtocols, type MarketRow } from "@/lib/market-data"

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
  const { rows, updatedAt, refresh, positions, rewardSummary, isLoading } = useMarketData(
    displayAddress
  )

  const [filters, setFilters] = React.useState<FilterState>(defaultFilters)
  const [sortKey, setSortKey] = React.useState<SortKey>("asset")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc")
  const [viewMode, setViewMode] = React.useState<ViewMode>("mixed")

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
  const protocolGroups = supportedProtocols.filter((protocol) =>
    filteredRows.some((row) => row.protocol === protocol)
  )
  const assetGroups = supportedAssets.filter((asset) =>
    filteredRows.some((row) => row.asset === asset)
  )
  const summaryRows = supportedProtocols
    .map((protocol) => rewardSummary.find((item) => item.protocol === protocol))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const hasSummaryData = summaryRows.some(
    (item) => item.supplies.length > 0 || item.rewards.length > 0
  )

  const formatAmount = (value: number) =>
    value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 12,
    })
  const formatRewardAmount = (value: number) =>
    value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 12,
    })

  const renderAlignedNumber = (
    value: number,
    formatFn: (value: number) => string
  ) => {
    const formatted = formatFn(value)
    const [whole, fraction] = formatted.split(".")
    return (
      <span className="inline-flex items-baseline tabular-nums">
        <span className="min-w-[6ch] text-right">{whole}</span>
        <span className="min-w-[1ch] text-left text-xs text-muted-foreground">
          {fraction ? `.${fraction}` : ""}
        </span>
      </span>
    )
  }

  const renderSupplyList = (supplies: { asset: string; amount: number }[]) => {
    if (!supplies.length) return "—"
    return (
      <div className="grid gap-1">
        {supplies.map((item) => (
          <div key={item.asset} className="grid grid-cols-[5ch_1fr] items-baseline gap-3">
            <span className="font-medium">{item.asset}</span>
            <span>{renderAlignedNumber(item.amount, formatAmount)}</span>
          </div>
        ))}
      </div>
    )
  }

  const renderRewardList = (rewards: { token: string; amount: number }[]) => {
    if (!rewards.length) return "—"
    return (
      <div className="grid gap-1">
        {rewards.map((item) => (
          <div key={item.token} className="grid grid-cols-[5ch_1fr] items-baseline gap-3">
            <span className="font-medium">{item.token}</span>
            <span>{renderAlignedNumber(item.amount, formatRewardAmount)}</span>
          </div>
        ))}
      </div>
    )
  }

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
          <div className="rounded-lg border bg-muted/20 p-3 text-xs">
            <div className="mb-2 font-semibold text-muted-foreground uppercase">
              Reward Summary
            </div>
            {!displayAddress ? (
              <div className="text-muted-foreground">
                Connect a wallet to view rewards.
              </div>
            ) : hasSummaryData ? (
              <div className="overflow-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-2 py-1">Protocol</th>
                      <th className="px-2 py-1">Supplied Assets</th>
                      <th className="px-2 py-1">Rewards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((item) => (
                      <tr key={item.protocol} className="border-b last:border-b-0">
                        <td className="px-2 py-1 font-medium">{item.protocol}</td>
                        <td className="px-2 py-1 align-top">
                          {renderSupplyList(item.supplies)}
                        </td>
                        <td className="px-2 py-1 align-top">
                          {renderRewardList(item.rewards)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30">
                      <td className="px-2 py-1 font-medium">Total</td>
                      <td className="px-2 py-1 align-top">
                        {renderSupplyList(totalSupplyList)}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {renderRewardList(totalRewardList)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-muted-foreground">No rewards detected.</div>
            )}
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">View</span>
              <Button
                variant={viewMode === "mixed" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setViewMode("mixed")}
              >
                Mixed
              </Button>
              <Button
                variant={viewMode === "byAsset" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setViewMode("byAsset")}
              >
                By Asset
              </Button>
              <Button
                variant={viewMode === "byProtocol" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setViewMode("byProtocol")}
              >
                By Protocol
              </Button>
            </div>
          </div>

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
