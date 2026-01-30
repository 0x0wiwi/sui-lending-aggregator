export type Protocol = "Scallop" | "Navi"
export type AssetSymbol = "SUI" | "USDC" | "USDT"

export type IncentiveBreakdown = {
  token: string
  apr: number
}

export type MarketRow = {
  asset: AssetSymbol
  protocol: Protocol
  supplyApr: number
  borrowApr: number
  incentiveApr: number
  utilization: number
  incentiveBreakdown?: IncentiveBreakdown[]
}

export const supportedAssets: AssetSymbol[] = ["SUI", "USDC", "USDT"]
export const supportedProtocols: Protocol[] = ["Scallop", "Navi"]

export function normalizeAssetSymbol(value?: string | null): AssetSymbol | null {
  if (!value) return null
  const upper = value.toUpperCase()
  if (upper.includes("USDC")) return "USDC"
  if (upper.includes("USDT")) return "USDT"
  if (upper.includes("SUI")) return "SUI"
  return null
}
