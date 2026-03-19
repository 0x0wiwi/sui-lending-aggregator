import {
  assetTypeAddresses,
  normalizeCoinType,
  type AssetCatalogEntry,
  type MarketRow,
} from "@/lib/market-data"

const assetCatalogStorageVersion = 1
const assetCatalogStorageKey = "lending-market-assets"

type StoredAssetCatalog = {
  version: number
  assets: AssetCatalogEntry[]
}

function sortAssetCatalog(entries: AssetCatalogEntry[]) {
  return [...entries].sort((a, b) => a.asset.localeCompare(b.asset))
}

function isAssetCatalogEntry(value: unknown): value is AssetCatalogEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<AssetCatalogEntry>
  return (
    typeof entry.asset === "string"
    && entry.asset.length > 0
    && typeof entry.coinType === "string"
    && entry.coinType.length > 0
  )
}

export function getDefaultAssetCatalog(): AssetCatalogEntry[] {
  return sortAssetCatalog(
    Object.entries(assetTypeAddresses).map(([asset, coinType]) => ({
      asset,
      coinType,
    }))
  )
}

export function loadAssetCatalog(storageKey = assetCatalogStorageKey) {
  if (typeof window === "undefined") return null
  const stored = window.localStorage.getItem(storageKey)
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as Partial<StoredAssetCatalog>
    if (parsed.version !== assetCatalogStorageVersion || !Array.isArray(parsed.assets)) {
      return null
    }
    const assets = parsed.assets
      .filter(isAssetCatalogEntry)
      .map((entry) => ({
        asset: entry.asset,
        coinType: normalizeCoinType(entry.coinType) ?? entry.coinType,
      }))
    return assets.length ? sortAssetCatalog(assets) : null
  } catch {
    return null
  }
}

export function saveAssetCatalog(
  assets: AssetCatalogEntry[],
  storageKey = assetCatalogStorageKey
) {
  if (typeof window === "undefined") return
  const payload: StoredAssetCatalog = {
    version: assetCatalogStorageVersion,
    assets: sortAssetCatalog(assets),
  }
  window.localStorage.setItem(storageKey, JSON.stringify(payload))
}

export function areAssetCatalogsEqual(
  left: AssetCatalogEntry[],
  right: AssetCatalogEntry[]
) {
  if (left.length !== right.length) return false
  return left.every((entry, index) => {
    const other = right[index]
    return entry.asset === other?.asset && entry.coinType === other?.coinType
  })
}

export function buildAssetCatalog(rows: MarketRow[]) {
  const candidates = new Map<string, Map<string, number>>()

  rows.forEach((row) => {
    const asset = row.asset.trim()
    const coinType = normalizeCoinType(row.coinType)
    if (!asset || !coinType) return
    const assetCandidates = candidates.get(asset) ?? new Map<string, number>()
    assetCandidates.set(coinType, (assetCandidates.get(coinType) ?? 0) + 1)
    candidates.set(asset, assetCandidates)
  })

  return sortAssetCatalog(
    Array.from(candidates.entries()).map(([asset, coinTypeCounts]) => {
      const knownCoinType = assetTypeAddresses[asset]
      if (knownCoinType && coinTypeCounts.has(knownCoinType)) {
        return { asset, coinType: knownCoinType }
      }

      const [coinType] = Array.from(coinTypeCounts.entries()).sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1]
        return left[0].localeCompare(right[0])
      })[0]

      return { asset, coinType }
    })
  )
}

export function buildAssetCoinTypeMap(assetCatalog: AssetCatalogEntry[]) {
  const map = { ...assetTypeAddresses } as Record<string, string>
  assetCatalog.forEach((entry) => {
    map[entry.asset] = entry.coinType
  })
  return map
}
