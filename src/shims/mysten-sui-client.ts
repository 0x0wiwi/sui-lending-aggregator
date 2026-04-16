import { SuiGrpcClient } from "@mysten/sui/grpc"

import { SuiLegacyClientAdapter } from "@/lib/sui-client"

export * from "../../node_modules/@mysten/sui/dist/client/index.mjs"

const fullnodeUrlByNetwork = {
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
} as const

type LegacyNetwork = keyof typeof fullnodeUrlByNetwork

export function getFullnodeUrl(network: LegacyNetwork) {
  return fullnodeUrlByNetwork[network]
}

export class SuiClient extends SuiLegacyClientAdapter {
  constructor({
    url,
    network = "mainnet",
  }: {
    url: string
    network?: LegacyNetwork
  }) {
    super(
      new SuiGrpcClient({
        baseUrl: url,
        network,
      })
    )
  }
}
