export type CurrentMarketVisibility = {
  borrowPaused?: boolean
  hidden?: boolean
  labelGroup?: unknown
  supplyPaused?: boolean
}

export function isCurrentMarketListed(market: CurrentMarketVisibility) {
  return !market.hidden && !market.labelGroup
}

export function isCurrentMarketSupplyAvailable(
  market: CurrentMarketVisibility
) {
  return !market.supplyPaused
}
