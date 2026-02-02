import * as React from "react"
import { useSuiClient } from "@mysten/dapp-kit"

export function useCoinDecimals(coinTypes: string[]) {
  const suiClient = useSuiClient()
  const [decimalsMap, setDecimalsMap] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    if (!coinTypes.length) return
    let isActive = true
    const fetchDecimals = async () => {
      const entries = await Promise.all(
        coinTypes.map(async (coinType) => {
          const metadata = await suiClient.getCoinMetadata({ coinType })
          return [coinType, metadata?.decimals ?? 0] as const
        })
      )
      if (!isActive) return
      setDecimalsMap((prev) => {
        const next = { ...prev }
        entries.forEach(([coinType, decimals]) => {
          next[coinType] = decimals
        })
        return next
      })
    }
    fetchDecimals().catch((error) => {
      console.error("Fetch coin decimals failed:", error)
    })
    return () => {
      isActive = false
    }
  }, [coinTypes, suiClient])

  return decimalsMap
}
