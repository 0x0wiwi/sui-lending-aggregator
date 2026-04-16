import { DAppKitProvider } from "@mysten/dapp-kit-react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import App from "@/App"
import { dAppKit } from "@/lib/dapp-kit"
import { ThemeProvider, useThemeState } from "@/lib/theme"

const queryClient = new QueryClient()

export function Root() {
  const theme = useThemeState()
  return (
    <ThemeProvider value={theme}>
      <QueryClientProvider client={queryClient}>
        <DAppKitProvider dAppKit={dAppKit}>
          <App />
        </DAppKitProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
