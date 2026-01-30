import type { AssetSymbol, Protocol } from "@/lib/market-data"

export type PositionKey = `${Protocol}-${AssetSymbol}`

export type WalletPositions = Partial<Record<PositionKey, number>>

export function createPositionKey(
  protocol: Protocol,
  asset: AssetSymbol
): PositionKey {
  return `${protocol}-${asset}`
}
