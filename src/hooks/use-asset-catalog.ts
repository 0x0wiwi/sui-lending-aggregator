import * as React from "react"

import {
  areAssetCatalogsEqual,
  buildAssetCatalog,
  buildAssetCoinTypeMap,
  getDefaultAssetCatalog,
  loadAssetCatalog,
  saveAssetCatalog,
} from "@/lib/asset-catalog"
import type { MarketRow } from "@/lib/market-data"

export function useAssetCatalog(rows: MarketRow[]) {
  const [assetCatalog, setAssetCatalog] = React.useState(() => {
    return loadAssetCatalog() ?? getDefaultAssetCatalog()
  })

  React.useEffect(() => {
    if (!rows.length) return
    const nextAssetCatalog = buildAssetCatalog(rows)
    React.startTransition(() => {
      setAssetCatalog((prev) => {
        if (areAssetCatalogsEqual(prev, nextAssetCatalog)) {
          return prev
        }
        saveAssetCatalog(nextAssetCatalog)
        return nextAssetCatalog
      })
    })
  }, [rows])

  const assetOptions = React.useMemo(
    () => assetCatalog.map((entry) => entry.asset),
    [assetCatalog]
  )
  const assetCoinTypes = React.useMemo(
    () => buildAssetCoinTypeMap(assetCatalog),
    [assetCatalog]
  )

  return {
    assetCatalog,
    assetOptions,
    assetCoinTypes,
  }
}
