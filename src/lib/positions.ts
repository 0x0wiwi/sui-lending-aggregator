import type { AssetSymbol, Protocol } from "@/lib/market-data"

export type PositionKey = `${Protocol}-${AssetSymbol}`

export type WalletPositions = Partial<Record<PositionKey, number>>

export function getMockPositions(address: string | null): WalletPositions {
  if (!address) return {}
  return {
    "Scallop-SUI": 24.5,
    "Suilend-USDC": 1200,
  }
}
