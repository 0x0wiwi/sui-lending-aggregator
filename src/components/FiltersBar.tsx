import * as React from "react"
import { FilterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { supportedProtocols } from "@/lib/market-data"

type FiltersBarProps = {
  assetOptions: string[]
  selectedAssets: string[]
  selectedProtocols: string[]
  onlyIncentive: boolean
  onlyPosition: boolean
  onToggleAsset: (asset: string) => void
  onToggleProtocol: (protocol: string) => void
  onToggleIncentive: () => void
  onTogglePosition: () => void
}

export function FiltersBar({
  assetOptions,
  selectedAssets,
  selectedProtocols,
  onlyIncentive,
  onlyPosition,
  onToggleAsset,
  onToggleProtocol,
  onToggleIncentive,
  onTogglePosition,
}: FiltersBarProps) {
  const [assetMenuOpen, setAssetMenuOpen] = React.useState(false)
  const [assetSearch, setAssetSearch] = React.useState("")
  const deferredAssetSearch = React.useDeferredValue(assetSearch)
  const normalizedAssetSearch = deferredAssetSearch.trim().toLowerCase()
  const filteredAssetOptions = React.useMemo(() => {
    if (!normalizedAssetSearch) return assetOptions
    return assetOptions.filter((asset) =>
      asset.toLowerCase().includes(normalizedAssetSearch)
    )
  }, [assetOptions, normalizedAssetSearch])

  React.useEffect(() => {
    if (!assetMenuOpen) {
      setAssetSearch("")
    }
  }, [assetMenuOpen])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu open={assetMenuOpen} onOpenChange={setAssetMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FilterIcon />
            Assets ({selectedAssets.length || "All"})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="p-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
          }}
        >
          <DropdownMenuLabel>Assets</DropdownMenuLabel>
          <div className="px-2 pb-2">
            <Input
              autoFocus
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation()
              }}
              placeholder="Search assets..."
              aria-label="Search assets"
            />
          </div>
          <DropdownMenuSeparator />
          {filteredAssetOptions.length ? filteredAssetOptions.map((asset) => (
            <DropdownMenuCheckboxItem
              key={asset}
              checked={selectedAssets.includes(asset)}
              onCheckedChange={() => onToggleAsset(asset)}
            >
              {asset}
            </DropdownMenuCheckboxItem>
          )) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No assets found.
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FilterIcon />
            Protocols ({selectedProtocols.length || "All"})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Protocols</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {supportedProtocols.map((protocol) => (
            <DropdownMenuCheckboxItem
              key={protocol}
              checked={selectedProtocols.includes(protocol)}
              onCheckedChange={() => onToggleProtocol(protocol)}
            >
              {protocol}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant={onlyPosition ? "secondary" : "outline"}
        size="sm"
        onClick={onTogglePosition}
      >
        Only Positions
      </Button>
      <Button
        variant={onlyIncentive ? "secondary" : "outline"}
        size="sm"
        onClick={onToggleIncentive}
      >
        Only Incentives
      </Button>
    </div>
  )
}
