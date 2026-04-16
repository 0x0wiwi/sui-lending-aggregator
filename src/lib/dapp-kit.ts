import { createDAppKit } from "@mysten/dapp-kit-react"
import { SuiGrpcClient } from "@mysten/sui/grpc"

const networks: ["mainnet"] = ["mainnet"]
const mainnetGrpcUrl = "https://fullnode.mainnet.sui.io:443"

export const dAppKit = createDAppKit({
  networks,
  defaultNetwork: "mainnet",
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: mainnetGrpcUrl,
    }),
})

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit
  }
}
