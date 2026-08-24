const SCALLOP_DEPRECATED_FALLBACK = new Set([
  "blub",
  "fud",
  "vsui",
  "wapt",
  "wbtc",
  "weth",
  "wusdc",
  "wusdt",
])

type ScallopSupplyState = {
  coinName: string
  maxSupplyCoin: number
  supplyCoin: number
}

export function isScallopMarketSupplyAvailable(
  pool: ScallopSupplyState,
  deprecated: ReadonlySet<string>,
  whitelistUnavailable: boolean
) {
  const deprecatedCoinNames = whitelistUnavailable
    ? SCALLOP_DEPRECATED_FALLBACK
    : deprecated
  return (
    !deprecatedCoinNames.has(pool.coinName)
    && pool.maxSupplyCoin > pool.supplyCoin
  )
}
