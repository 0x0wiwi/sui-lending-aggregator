import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk"
import type { SuiGrpcClient } from "@mysten/sui/grpc"

export const CETUS_AGGREGATOR_ENDPOINT =
  "https://api-sui-cloudfront.cetus.zone/router_v3"
export const CETUS_SLIPPAGE = 0.001

export function createAggregatorClient(
  suiClient: SuiGrpcClient,
  signer: string
) {
  return new AggregatorClient({
    endpoint: CETUS_AGGREGATOR_ENDPOINT,
    env: Env.Mainnet,
    signer,
    client: suiClient,
  })
}
