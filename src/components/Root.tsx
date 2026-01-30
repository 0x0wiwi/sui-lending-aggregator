import { DAppKitProvider, createDAppKit } from "@mysten/dapp-kit-react"
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc"

import App from "@/App"
import { ThemeProvider, useThemeState } from "@/lib/theme"

const dAppKit = createDAppKit({
  networks: ["mainnet"],
  defaultNetwork: "mainnet",
  autoConnect: true,
  createClient: (network) =>
    new SuiJsonRpcClient({
      network,
      url: getJsonRpcFullnodeUrl(network),
    }),
})

export function Root() {
  const theme = useThemeState()
  return (
    <ThemeProvider value={theme}>
      <DAppKitProvider dAppKit={dAppKit}>
        <App />
      </DAppKitProvider>
    </ThemeProvider>
  )
}
