export type CurrentMarketVisibility = {
  borrowPaused?: boolean
  hidden?: boolean
  labelGroup?: unknown
  supplyPaused?: boolean
}

export function isCurrentMarketVisible(market: CurrentMarketVisibility) {
  return !market.hidden
    && !market.labelGroup
    && !(market.supplyPaused && market.borrowPaused)
}
