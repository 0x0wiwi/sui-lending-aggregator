import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MarketRow } from "@/lib/market-data"
import type { WalletPositions } from "@/lib/positions"
import { cn } from "@/lib/utils"

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
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
}

const formatApr = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(3)}%` : "—"
const formatUtilization = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(3)}%` : "—"

function getPositionAmount(
  positions: WalletPositions,
  protocol: MarketRow["protocol"],
  asset: MarketRow["asset"]
) {
  const key = `${protocol}-${asset}` as keyof WalletPositions
  return positions[key] ?? null
}

function AprCell({
  totalApr,
  baseApr,
  incentiveApr,
  breakdown,
  hoverLabel,
  row,
}: {
  totalApr: number
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
      : totalApr
  return (
    <div
      className="relative inline-flex items-center gap-1"
      onMouseEnter={hasIncentive ? () => setOpen(true) : undefined}
      onMouseLeave={hasIncentive ? () => setOpen(false) : undefined}
    >
      <span>{formatApr(totalApr)}</span>
      {hasIncentive ? (
        <span className={cn("text-xs font-medium", incentiveClass)}>
          {incentivePrefix}
          {formatApr(incentiveApr)}
        </span>
      ) : null}
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
              Incentives: {formatApr(incentiveApr)}
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
}: MarketTableProps) {
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
                    <Badge variant="secondary">{row.asset}</Badge>
                  </td>
                  <td className="px-3 py-3">{row.protocol}</td>
                  <td className="px-3 py-3">
                    <AprCell
                      totalApr={row.supplyApr}
                      baseApr={row.supplyBaseApr}
                      incentiveApr={row.supplyIncentiveApr}
                      breakdown={row.supplyIncentiveBreakdown}
                      hoverLabel="Supply"
                      row={row}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <AprCell
                      totalApr={row.borrowApr}
                      baseApr={row.borrowBaseApr}
                      incentiveApr={row.borrowIncentiveApr}
                      breakdown={row.borrowIncentiveBreakdown}
                      hoverLabel="Borrow"
                      row={row}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {formatUtilization(row.utilization)}
                  </td>
                  <td className="px-3 py-3">
                    {position ? position.toLocaleString() : "—"}
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
                  <Badge variant="secondary">{row.asset}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {row.protocol}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Supply APR</span>
                  <AprCell
                    totalApr={row.supplyApr}
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
                    totalApr={row.borrowApr}
                    baseApr={row.borrowBaseApr}
                    incentiveApr={row.borrowIncentiveApr}
                    breakdown={row.borrowIncentiveBreakdown}
                    hoverLabel="Borrow"
                    row={row}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Utilization</span>
                  <span>{formatUtilization(row.utilization)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your Supply</span>
                  <span className={cn(!position && "text-muted-foreground")}>
                    {position ? position.toLocaleString() : "—"}
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
