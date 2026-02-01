import {
  normalizeAssetSymbol,
  type AssetSymbol,
  type RewardSummaryItem,
} from "@/lib/market-data"
import type { WalletPositions } from "@/lib/positions"

export function toNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return 0
}

export function toAssetSymbolFromSource(
  symbol?: string | null,
  coinType?: string | null
): AssetSymbol | null {
  return normalizeAssetSymbol(coinType) ?? normalizeAssetSymbol(symbol)
}

export function formatTokenSymbol(coinType: string) {
  const parts = coinType.split("::")
  return parts[parts.length - 1] ?? coinType
}

export function sumBreakdown(items: { apr: number }[]) {
  return items.reduce((sum, item) => sum + item.apr, 0)
}

export function buildSupplyList(
  positions: WalletPositions,
  protocol: RewardSummaryItem["protocol"]
) {
  return Object.entries(positions)
    .filter(([key, amount]) => key.startsWith(`${protocol}-`) && amount > 0)
    .map(([key, amount]) => {
      const [, asset] = key.split("-") as [string, AssetSymbol]
      return { asset, amount }
    })
}
