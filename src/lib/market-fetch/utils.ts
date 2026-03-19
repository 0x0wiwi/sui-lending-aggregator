import {
  normalizeCoinType,
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
  const knownAsset = normalizeAssetSymbol(coinType)
  if (knownAsset) return knownAsset
  const normalizedSymbol = symbol?.trim()
  if (normalizedSymbol) return normalizedSymbol
  const normalizedCoinType = normalizeCoinType(coinType)
  if (!normalizedCoinType) return null
  const parts = normalizedCoinType.split("::")
  return parts[parts.length - 1] ?? normalizedCoinType
}

export function formatTokenSymbol(coinType: string) {
  const parts = coinType.split("::")
  return parts[parts.length - 1] ?? coinType
}

export function toNormalizedCoinType(coinType?: string | null) {
  return normalizeCoinType(coinType)
}

export function sumBreakdown(items: { apr: number }[]) {
  return items.reduce((sum, item) => sum + item.apr, 0)
}

export function buildSupplyList(
  positions: WalletPositions,
  protocol: RewardSummaryItem["protocol"]
) {
  return Object.entries(positions)
    .filter(
      (entry): entry is [string, number] =>
        entry[0].startsWith(`${protocol}-`) && typeof entry[1] === "number" && entry[1] > 0
    )
    .map(([key, amount]) => {
      const [, asset] = key.split("-") as [string, string]
      return { asset, amount }
    })
}
