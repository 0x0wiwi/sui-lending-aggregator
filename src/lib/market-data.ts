export type Protocol = "Scallop" | "Navi" | "Suilend"
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
  utilization: number
  supplyBaseApr: number
  borrowBaseApr: number
  supplyIncentiveApr: number
  borrowIncentiveApr: number
  supplyIncentiveBreakdown?: IncentiveBreakdown[]
  borrowIncentiveBreakdown?: IncentiveBreakdown[]
}

export const supportedAssets: AssetSymbol[] = ["SUI", "USDC", "USDT"]
export const supportedProtocols: Protocol[] = ["Scallop", "Navi", "Suilend"]
export const assetTypeAddresses: Record<AssetSymbol, string> = {
  SUI: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  USDC: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  USDT: "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
}

export function normalizeAssetSymbol(value?: string | null): AssetSymbol | null {
  if (!value) return null
  const lower = value.toLowerCase()
  const address = lower.includes("::") ? lower.split("::")[0] : lower
  const addressMap: Record<string, AssetSymbol> = {
    "0x0000000000000000000000000000000000000000000000000000000000000002": "SUI",
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7": "USDC",
    "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068": "USDT",
  }
  if (address in addressMap) return addressMap[address]
  for (const [addr, asset] of Object.entries(addressMap)) {
    if (lower.startsWith(addr) || lower.includes(addr)) return asset
  }
  const upper = value.toUpperCase()
  if (upper.includes("USDC")) return "USDC"
  if (upper.includes("USDT")) return "USDT"
  if (upper.includes("SUI")) return "SUI"
  return null
}
