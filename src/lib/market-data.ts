import type { Side } from "@suilend/sdk/lib/types"

export type Protocol = "Scallop" | "Navi" | "Suilend" | "AlphaLend"
export type AssetSymbol = "SUI" | "USDC" | "USDT" | "XBTC" | "DEEP" | "WAL"

export type IncentiveBreakdown = {
  token: string
  apr: number
}

export type RewardTokenAmount = {
  token: string
  amount: number
}

export type RewardSupply = {
  asset: AssetSymbol
  amount: number
}

export type RewardSummaryItem = {
  protocol: Protocol
  supplies: RewardSupply[]
  rewards: RewardTokenAmount[]
  claimMeta?: {
    suilend?: {
      rewards: Array<{
        reserveArrayIndex: bigint
        rewardIndex: bigint
        rewardCoinType: string
        side: Side
      }>
    }
  }
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

export const supportedAssets: AssetSymbol[] = [
  "SUI",
  "USDC",
  "USDT",
  "XBTC",
  "DEEP",
  "WAL",
]
export const supportedProtocols: Protocol[] = [
  "Scallop",
  "Navi",
  "Suilend",
  "AlphaLend",
]
export const assetTypeAddresses: Record<AssetSymbol, string> = {
  SUI: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  USDC: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  USDT: "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
  XBTC: "0x876a4b7bce8aeaef60464c11f4026903e9afacab79b9b142686158aa86560b50::xbtc::XBTC",
  DEEP: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
  WAL: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
}

export function normalizeAssetSymbol(value?: string | null): AssetSymbol | null {
  if (!value) return null
  const lower = value.toLowerCase()
  const address = lower.includes("::") ? lower.split("::")[0] : lower
  if (!address.startsWith("0x")) return null
  const normalizedAddress = `0x${address.slice(2).padStart(64, "0")}`
  const addressMap: Record<string, AssetSymbol> = {
    "0x0000000000000000000000000000000000000000000000000000000000000002": "SUI",
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7": "USDC",
    "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068": "USDT",
    "0x876a4b7bce8aeaef60464c11f4026903e9afacab79b9b142686158aa86560b50": "XBTC",
    "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270": "DEEP",
    "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59": "WAL",
  }
  return addressMap[normalizedAddress] ?? null
}
