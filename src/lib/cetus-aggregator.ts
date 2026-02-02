import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk"
import type { SuiClient } from "@mysten/sui/client"

export const CETUS_AGGREGATOR_ENDPOINT =
  "https://api-sui-cloudfront.cetus.zone/router_v3"
export const CETUS_SLIPPAGE = 0.001

export function createAggregatorClient(suiClient: SuiClient, signer: string) {
  return new AggregatorClient({
    endpoint: CETUS_AGGREGATOR_ENDPOINT,
    env: Env.Mainnet,
    signer,
    client: suiClient,
  })
}
