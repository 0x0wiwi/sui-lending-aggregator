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
  incentiveApr: number
  utilization: number
  incentiveBreakdown?: IncentiveBreakdown[]
}

export const supportedAssets: AssetSymbol[] = ["SUI", "USDC", "USDT"]
export const supportedProtocols: Protocol[] = ["Scallop", "Navi", "Suilend"]

export function getMockMarketRows(): MarketRow[] {
  return [
  {
    asset: "SUI",
    protocol: "Scallop",
    supplyApr: 4.2,
    borrowApr: 9.6,
    incentiveApr: 3.1,
    utilization: 62.4,
    incentiveBreakdown: [
      { token: "SCA", apr: 1.5 },
      { token: "SUI", apr: 1.6 },
    ],
  },
  {
    asset: "USDC",
    protocol: "Scallop",
    supplyApr: 6.4,
    borrowApr: 11.2,
    incentiveApr: 0,
    utilization: 54.1,
  },
  {
    asset: "USDT",
    protocol: "Scallop",
    supplyApr: 5.8,
    borrowApr: 10.5,
    incentiveApr: 1.4,
    utilization: 69.8,
    incentiveBreakdown: [{ token: "SCA", apr: 1.4 }],
  },
  {
    asset: "SUI",
    protocol: "Navi",
    supplyApr: 3.5,
    borrowApr: 8.9,
    incentiveApr: 2.2,
    utilization: 71.2,
    incentiveBreakdown: [{ token: "NAVX", apr: 2.2 }],
  },
  {
    asset: "USDC",
    protocol: "Navi",
    supplyApr: 5.1,
    borrowApr: 10.1,
    incentiveApr: 0,
    utilization: 48.7,
  },
  {
    asset: "USDT",
    protocol: "Navi",
    supplyApr: 4.9,
    borrowApr: 9.7,
    incentiveApr: 1.0,
    utilization: 52.3,
    incentiveBreakdown: [{ token: "NAVX", apr: 1.0 }],
  },
  {
    asset: "SUI",
    protocol: "Suilend",
    supplyApr: 3.1,
    borrowApr: 7.8,
    incentiveApr: 0,
    utilization: 44.6,
  },
  {
    asset: "USDC",
    protocol: "Suilend",
    supplyApr: 4.6,
    borrowApr: 9.2,
    incentiveApr: 2.8,
    utilization: 63.9,
    incentiveBreakdown: [
      { token: "SEND", apr: 1.2 },
      { token: "SUI", apr: 1.6 },
    ],
  },
  {
    asset: "USDT",
    protocol: "Suilend",
    supplyApr: 4.2,
    borrowApr: 8.6,
    incentiveApr: 0,
    utilization: 58.4,
  },
  ]
}
