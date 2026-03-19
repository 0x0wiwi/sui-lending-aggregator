import * as React from "react"
import { useSuiClient } from "@mysten/dapp-kit"

import {
  type CachedCoinMetadata,
  fetchAndCacheCoinMetadata,
  getCachedCoinMetadataSnapshot,
} from "@/lib/coin-metadata-cache"
import { normalizeCoinType } from "@/lib/market-data"

function mergeMetadataMaps(
  current: Record<string, CachedCoinMetadata>,
  updates: Record<string, CachedCoinMetadata>
) {
  const next = { ...current }
  let hasChanges = false

  Object.entries(updates).forEach(([coinType, metadata]) => {
    const existing = next[coinType]
    if (
      existing?.decimals === metadata.decimals
      && existing.description === metadata.description
      && existing.iconUrl === metadata.iconUrl
      && existing.id === metadata.id
      && existing.name === metadata.name
      && existing.symbol === metadata.symbol
    ) {
      return
    }
    next[coinType] = metadata
    hasChanges = true
  })

  return hasChanges ? next : current
}

export function useCoinDecimals(coinTypes: string[]) {
  const suiClient = useSuiClient()
  const normalizedCoinTypes = React.useMemo(
    () =>
      Array.from(
        new Set(
          coinTypes
            .map((coinType) => normalizeCoinType(coinType))
            .filter((coinType): coinType is string => Boolean(coinType))
        )
      ).sort(),
    [coinTypes]
  )
  const [metadataMap, setMetadataMap] = React.useState<Record<string, CachedCoinMetadata>>(
    () => getCachedCoinMetadataSnapshot(normalizedCoinTypes).metadataByCoinType
  )

  React.useEffect(() => {
    if (!normalizedCoinTypes.length) return
    let isActive = true
    const snapshot = getCachedCoinMetadataSnapshot(normalizedCoinTypes)
    setMetadataMap((prev) => mergeMetadataMaps(prev, snapshot.metadataByCoinType))

    const coinTypesToFetch = [
      ...snapshot.missingCoinTypes,
      ...snapshot.staleCoinTypes.filter((coinType) =>
        !snapshot.missingCoinTypes.includes(coinType)
      ),
    ]
    if (!coinTypesToFetch.length) {
      return () => {
        isActive = false
      }
    }

    const fetchDecimals = async () => {
      const fetchedMetadata = await fetchAndCacheCoinMetadata(
        coinTypesToFetch,
        suiClient
      )
      if (!isActive) return
      const availableMetadata = Object.entries(fetchedMetadata).reduce<
        Record<string, CachedCoinMetadata>
      >((acc, [coinType, metadata]) => {
        if (metadata) {
          acc[coinType] = metadata
        }
        return acc
      }, {})
      setMetadataMap((prev) => mergeMetadataMaps(prev, availableMetadata))
    }
    fetchDecimals().catch((error) => {
      console.error("Fetch coin decimals failed:", error)
    })
    return () => {
      isActive = false
    }
  }, [normalizedCoinTypes, suiClient])

  return React.useMemo(
    () =>
      normalizedCoinTypes.reduce<Record<string, number>>((acc, coinType) => {
        const metadata = metadataMap[coinType]
        if (!metadata) return acc
        acc[coinType] = metadata.decimals
        return acc
      }, {}),
    [metadataMap, normalizedCoinTypes]
  )
}
