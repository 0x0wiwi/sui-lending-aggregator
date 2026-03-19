import type { CoinMetadata, SuiClient } from "@mysten/sui/client"

import { normalizeCoinType } from "@/lib/market-data"

export type CachedCoinMetadata = {
  decimals: number
  description: string
  iconUrl?: string | null
  id?: string | null
  name: string
  symbol: string
}

type CachedCoinMetadataEntry = {
  fetchedAt: number
  metadata: CachedCoinMetadata | null
}

type StoredCoinMetadataCache = {
  version: number
  entries: Record<string, CachedCoinMetadataEntry>
}

const coinMetadataCacheVersion = 1
const coinMetadataCacheStorageKey = "sui-coin-metadata-cache"
export const coinMetadataCacheTtlMs = 7 * 24 * 60 * 60 * 1000
const inFlightMetadataRequests = new Map<string, Promise<CachedCoinMetadata | null>>()

function normalizeRequestedCoinTypes(coinTypes: string[]) {
  return Array.from(
    new Set(
      coinTypes
        .map((coinType) => normalizeCoinType(coinType))
        .filter((coinType): coinType is string => Boolean(coinType))
    )
  ).sort()
}

function isCachedCoinMetadata(value: unknown): value is CachedCoinMetadata {
  if (!value || typeof value !== "object") return false
  const metadata = value as Partial<CachedCoinMetadata>
  return (
    typeof metadata.decimals === "number"
    && Number.isFinite(metadata.decimals)
    && typeof metadata.description === "string"
    && typeof metadata.name === "string"
    && typeof metadata.symbol === "string"
  )
}

function isCachedCoinMetadataEntry(value: unknown): value is CachedCoinMetadataEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<CachedCoinMetadataEntry>
  return (
    typeof entry.fetchedAt === "number"
    && Number.isFinite(entry.fetchedAt)
    && (entry.metadata === null || isCachedCoinMetadata(entry.metadata))
  )
}

function sanitizeCoinMetadata(metadata: CoinMetadata | null): CachedCoinMetadata | null {
  if (!metadata) return null
  return {
    decimals: metadata.decimals,
    description: metadata.description,
    iconUrl: metadata.iconUrl ?? null,
    id: metadata.id ?? null,
    name: metadata.name,
    symbol: metadata.symbol,
  }
}

function loadCoinMetadataCache(storageKey = coinMetadataCacheStorageKey) {
  if (typeof window === "undefined") return {}
  const stored = window.localStorage.getItem(storageKey)
  if (!stored) return {}
  try {
    const parsed = JSON.parse(stored) as Partial<StoredCoinMetadataCache>
    if (
      parsed.version !== coinMetadataCacheVersion
      || !parsed.entries
      || typeof parsed.entries !== "object"
    ) {
      return {}
    }

    return Object.entries(parsed.entries).reduce<Record<string, CachedCoinMetadataEntry>>(
      (acc, [coinType, entry]) => {
        const normalizedCoinType = normalizeCoinType(coinType)
        if (!normalizedCoinType || !isCachedCoinMetadataEntry(entry)) {
          return acc
        }
        acc[normalizedCoinType] = {
          fetchedAt: entry.fetchedAt,
          metadata: entry.metadata,
        }
        return acc
      },
      {}
    )
  } catch {
    return {}
  }
}

function saveCoinMetadataCache(
  entries: Record<string, CachedCoinMetadataEntry>,
  storageKey = coinMetadataCacheStorageKey
) {
  if (typeof window === "undefined") return
  const payload: StoredCoinMetadataCache = {
    version: coinMetadataCacheVersion,
    entries,
  }
  window.localStorage.setItem(storageKey, JSON.stringify(payload))
}

async function fetchCoinMetadataWithDedup(
  suiClient: Pick<SuiClient, "getCoinMetadata">,
  coinType: string
) {
  const existing = inFlightMetadataRequests.get(coinType)
  if (existing) return existing

  const request = suiClient
    .getCoinMetadata({ coinType })
    .then((metadata) => sanitizeCoinMetadata(metadata))
    .finally(() => {
      inFlightMetadataRequests.delete(coinType)
    })

  inFlightMetadataRequests.set(coinType, request)
  return request
}

export function getCachedCoinMetadataSnapshot(
  coinTypes: string[],
  now = Date.now(),
  storageKey = coinMetadataCacheStorageKey
) {
  const cache = loadCoinMetadataCache(storageKey)
  const normalizedCoinTypes = normalizeRequestedCoinTypes(coinTypes)
  const metadataByCoinType: Record<string, CachedCoinMetadata> = {}
  const staleCoinTypes: string[] = []
  const missingCoinTypes: string[] = []

  normalizedCoinTypes.forEach((coinType) => {
    const cached = cache[coinType]
    if (!cached) {
      missingCoinTypes.push(coinType)
      return
    }

    if (cached.metadata) {
      metadataByCoinType[coinType] = cached.metadata
    }

    if (now - cached.fetchedAt > coinMetadataCacheTtlMs) {
      staleCoinTypes.push(coinType)
    }
  })

  return {
    metadataByCoinType,
    staleCoinTypes,
    missingCoinTypes,
  }
}

export async function fetchAndCacheCoinMetadata(
  coinTypes: string[],
  suiClient: Pick<SuiClient, "getCoinMetadata">,
  storageKey = coinMetadataCacheStorageKey
) {
  const normalizedCoinTypes = normalizeRequestedCoinTypes(coinTypes)
  if (!normalizedCoinTypes.length) {
    return {} as Record<string, CachedCoinMetadata | null>
  }

  const results = await Promise.allSettled(
    normalizedCoinTypes.map(async (coinType) => {
      return fetchCoinMetadataWithDedup(suiClient, coinType)
    })
  )

  const nextCache = loadCoinMetadataCache(storageKey)
  const fetchedAt = Date.now()
  const fetchedEntries: Array<readonly [string, CachedCoinMetadata | null]> = []

  results.forEach((result, index) => {
    const coinType = normalizedCoinTypes[index]
    if (result.status !== "fulfilled") {
      console.error(`Fetch coin metadata failed for ${coinType}:`, result.reason)
      return
    }
    fetchedEntries.push([coinType, result.value] as const)
    nextCache[coinType] = {
      fetchedAt,
      metadata: result.value,
    }
  })

  if (fetchedEntries.length) {
    saveCoinMetadataCache(nextCache, storageKey)
  }

  return Object.fromEntries(fetchedEntries) as Record<string, CachedCoinMetadata | null>
}
