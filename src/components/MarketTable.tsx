import * as React from "react"
import BigNumber from "bignumber.js"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { assetTypeAddresses, type MarketRow } from "@/lib/market-data"
import type { WalletPositions } from "@/lib/positions"
import { cn } from "@/lib/utils"
import { formatApr, renderAlignedPercent } from "@/components/market-table/formatters"

export type SortKey =
  | "asset"
  | "protocol"
  | "supplyApr"
  | "borrowApr"
  | "utilization"
  | "yourSupply"

export type SortDirection = "asc" | "desc"

type MarketTableProps = {
  rows: MarketRow[]
  positions: WalletPositions
  coinDecimalsMap: Record<string, number>
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
}

function getPositionAmount(
  positions: WalletPositions,
  protocol: MarketRow["protocol"],
  asset: MarketRow["asset"]
) {
  const key = `${protocol}-${asset}` as keyof WalletPositions
  return positions[key] ?? null
}

function AprCell({
  primaryApr,
  baseApr,
  incentiveApr,
  breakdown,
  hoverLabel,
  row,
}: {
  primaryApr: number
  baseApr: number
  incentiveApr: number
  breakdown?: MarketRow["supplyIncentiveBreakdown"]
  hoverLabel: "Supply" | "Borrow"
  row: MarketRow
}) {
  const hasIncentive = incentiveApr > 0
  const [open, setOpen] = React.useState(false)
  const incentivePrefix = hoverLabel === "Borrow" ? "-" : "+"
  const incentiveClass =
    hoverLabel === "Borrow"
      ? "text-rose-600 dark:text-rose-400"
      : "text-emerald-600 dark:text-emerald-400"
  const netLabel = hoverLabel === "Borrow" ? "Net cost" : "Net yield"
  const netValue =
    hoverLabel === "Borrow"
      ? Math.max(baseApr - incentiveApr, 0)
      : baseApr + incentiveApr
  const primaryValue = primaryApr
  const primaryClass =
    hasIncentive
      ? hoverLabel === "Borrow"
        ? "text-rose-600 dark:text-rose-400"
        : "text-emerald-600 dark:text-emerald-400"
      : undefined
  return (
    <div
      className="relative inline-flex items-center gap-1"
      onMouseEnter={hasIncentive ? () => setOpen(true) : undefined}
      onMouseLeave={hasIncentive ? () => setOpen(false) : undefined}
    >
      {renderAlignedPercent(primaryValue, primaryClass)}
      {hasIncentive ? (
        <div
          className={cn(
            "pointer-events-none absolute left-0 top-full z-40 mt-2 w-56 rounded-md border bg-popover p-2 text-xs shadow-md",
            open ? "block" : "hidden"
          )}
        >
          <div className="text-muted-foreground">{hoverLabel} APR</div>
          <div className="mt-1 space-y-1">
                <div>Base: {formatApr(baseApr)}</div>
                <div className={incentiveClass}>
                  Incentives: {incentivePrefix}
                  {formatApr(incentiveApr)}
            </div>
            <div>{netLabel}: {formatApr(netValue)}</div>
          </div>
          {breakdown?.length ? (
            <div className="mt-2 border-t pt-2 space-y-1">
              {breakdown.map((item) => (
                <div key={`${row.protocol}-${row.asset}-${hoverLabel}-${item.token}`}>
                  {item.token}: {formatApr(item.apr)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

async function copyAssetAddress(asset: MarketRow["asset"]) {
  const address = assetTypeAddresses[asset]
  if (!address) return
  try {
    await navigator.clipboard.writeText(address)
  } catch (error) {
    console.error("Copy asset address failed:", error)
  }
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto px-0 py-0 text-xs font-medium"
      onClick={onClick}
    >
      <span className="mr-1">{label}</span>
      {active ? (
        direction === "asc" ? (
          <ChevronUpIcon className="size-3" />
        ) : (
          <ChevronDownIcon className="size-3" />
        )
      ) : null}
    </Button>
  )
}

export function MarketTable({
  rows,
  positions,
  sortKey,
  sortDirection,
  onSort,
  coinDecimalsMap,
}: MarketTableProps) {
  const [copiedAsset, setCopiedAsset] = React.useState<MarketRow["asset"] | null>(null)
  const copyTimer = React.useRef<number | null>(null)

  const handleCopy = React.useCallback(async (asset: MarketRow["asset"]) => {
    await copyAssetAddress(asset)
    setCopiedAsset(asset)
    if (copyTimer.current) {
      window.clearTimeout(copyTimer.current)
    }
    copyTimer.current = window.setTimeout(() => {
      setCopiedAsset(null)
    }, 1500)
  }, [])

  React.useEffect(() => {
    return () => {
      if (copyTimer.current) {
        window.clearTimeout(copyTimer.current)
      }
    }
  }, [])

  const formatTokenAmount = React.useCallback(
    (asset: MarketRow["asset"], amount: number | null) => {
      if (amount === null) return "—"
      const coinType = assetTypeAddresses[asset]
      const decimals = coinType ? coinDecimalsMap[coinType] : undefined
      const maxDigits =
        typeof decimals === "number" && Number.isFinite(decimals)
          ? Math.max(decimals, 0)
          : 12
      const fixed = new BigNumber(amount).toFixed(maxDigits, BigNumber.ROUND_FLOOR)
      const [whole, fractionRaw] = fixed.split(".")
      const fraction = fractionRaw ? fractionRaw.replace(/0+$/, "") : ""
      const wholeFormatted = Number(whole).toLocaleString("en-US", {
        maximumFractionDigits: 0,
      })
      return fraction ? `${wholeFormatted}.${fraction}` : wholeFormatted
    },
    [coinDecimalsMap]
  )

  return (
    <>
      <div className="hidden border overflow-visible md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <SortButton
                  label="Asset"
                  active={sortKey === "asset"}
                  direction={sortDirection}
                  onClick={() => onSort("asset")}
                />
              </th>
              <th className="px-3 py-2">
                <SortButton
                  label="Protocol"
                  active={sortKey === "protocol"}
                  direction={sortDirection}
                  onClick={() => onSort("protocol")}
                />
              </th>
              <th className="px-3 py-2">
                <SortButton
                  label="Supply APR"
                  active={sortKey === "supplyApr"}
                  direction={sortDirection}
                  onClick={() => onSort("supplyApr")}
                />
              </th>
              <th className="px-3 py-2">
                <SortButton
                  label="Borrow APR"
                  active={sortKey === "borrowApr"}
                  direction={sortDirection}
                  onClick={() => onSort("borrowApr")}
                />
              </th>
              <th className="px-3 py-2">
                <SortButton
                  label="Utilization"
                  active={sortKey === "utilization"}
                  direction={sortDirection}
                  onClick={() => onSort("utilization")}
                />
              </th>
              <th className="px-3 py-2">
                <SortButton
                  label="Your Supply"
                  active={sortKey === "yourSupply"}
                  direction={sortDirection}
                  onClick={() => onSort("yourSupply")}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const position = getPositionAmount(
                positions,
                row.protocol,
                row.asset
              )
              return (
                <tr
                  key={`${row.protocol}-${row.asset}`}
                  className="border-t"
                >
                  <td className="px-3 py-3">
                    <span className="relative inline-flex items-center">
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => handleCopy(row.asset)}
                        title="Copy asset address"
                      >
                        <Badge variant="secondary">{row.asset}</Badge>
                      </button>
                      {copiedAsset === row.asset ? (
                        <span className="pointer-events-none absolute left-full ml-2 text-xs text-muted-foreground whitespace-nowrap">
                          Copied
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-3">{row.protocol}</td>
                  <td className="px-3 py-3">
                    <AprCell
                      primaryApr={row.supplyApr}
                      baseApr={row.supplyBaseApr}
                      incentiveApr={row.supplyIncentiveApr}
                      breakdown={row.supplyIncentiveBreakdown}
                      hoverLabel="Supply"
                      row={row}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <AprCell
                      primaryApr={row.borrowApr}
                      baseApr={row.borrowBaseApr}
                      incentiveApr={row.borrowIncentiveApr}
                      breakdown={row.borrowIncentiveBreakdown}
                      hoverLabel="Borrow"
                      row={row}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {renderAlignedPercent(row.utilization)}
                  </td>
                  <td className="px-3 py-3">
                    {formatTokenAmount(row.asset, position)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => {
          const position = getPositionAmount(
            positions,
            row.protocol,
            row.asset
          )
          return (
            <Card key={`${row.protocol}-${row.asset}`} size="sm">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="relative inline-flex items-center">
                    <button
                      type="button"
                      className="cursor-pointer"
                      onClick={() => handleCopy(row.asset)}
                      title="Copy asset address"
                    >
                      <Badge variant="secondary">{row.asset}</Badge>
                    </button>
                    {copiedAsset === row.asset ? (
                      <span className="pointer-events-none absolute left-full ml-2 text-xs text-muted-foreground whitespace-nowrap">
                        Copied
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.protocol}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Supply APR</span>
                  <AprCell
                    primaryApr={row.supplyApr}
                    baseApr={row.supplyBaseApr}
                    incentiveApr={row.supplyIncentiveApr}
                    breakdown={row.supplyIncentiveBreakdown}
                    hoverLabel="Supply"
                    row={row}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Borrow APR</span>
                  <AprCell
                    primaryApr={row.borrowApr}
                    baseApr={row.borrowBaseApr}
                    incentiveApr={row.borrowIncentiveApr}
                    breakdown={row.borrowIncentiveBreakdown}
                    hoverLabel="Borrow"
                    row={row}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Utilization</span>
                  <span>{renderAlignedPercent(row.utilization)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your Supply</span>
                  <span className={cn(!position && "text-muted-foreground")}>
                    {formatTokenAmount(row.asset, position)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
