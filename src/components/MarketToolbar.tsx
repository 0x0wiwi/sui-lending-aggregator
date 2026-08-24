import { Button } from "@/components/ui/button"
import { FiltersBar } from "@/components/FiltersBar"

type MarketToolbarProps = {
  assetOptions: string[]
  selectedAssets: string[]
  selectedProtocols: string[]
  onlyIncentive: boolean
  onlyPosition: boolean
  hideUnavailable: boolean
  viewMode: "mixed" | "byAsset" | "byProtocol"
  onToggleAsset: (asset: string) => void
  onToggleProtocol: (protocol: string) => void
  onToggleIncentive: () => void
  onTogglePosition: () => void
  onToggleUnavailable: () => void
  onClearFilters: () => void
  onChangeView: (view: "mixed" | "byAsset" | "byProtocol") => void
}

export function MarketToolbar({
  assetOptions,
  selectedAssets,
  selectedProtocols,
  onlyIncentive,
  onlyPosition,
  hideUnavailable,
  viewMode,
  onToggleAsset,
  onToggleProtocol,
  onToggleIncentive,
  onTogglePosition,
  onToggleUnavailable,
  onClearFilters,
  onChangeView,
}: MarketToolbarProps) {
  const isClearDisabled =
    !selectedAssets.length
    && !selectedProtocols.length
    && !onlyIncentive
    && !onlyPosition
    && hideUnavailable
    && viewMode === "mixed"

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FiltersBar
        assetOptions={assetOptions}
        selectedAssets={selectedAssets}
        selectedProtocols={selectedProtocols}
        onlyIncentive={onlyIncentive}
        onlyPosition={onlyPosition}
        hideUnavailable={hideUnavailable}
        onToggleAsset={onToggleAsset}
        onToggleProtocol={onToggleProtocol}
        onToggleIncentive={onToggleIncentive}
        onTogglePosition={onTogglePosition}
        onToggleUnavailable={onToggleUnavailable}
      />
      <div className="flex flex-wrap items-center gap-2 md:mx-auto">
        <span className="text-xs text-muted-foreground">View</span>
        <Button
          variant={viewMode === "mixed" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onChangeView("mixed")}
        >
          Mixed
        </Button>
        <Button
          variant={viewMode === "byAsset" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onChangeView("byAsset")}
        >
          By Asset
        </Button>
        <Button
          variant={viewMode === "byProtocol" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onChangeView("byProtocol")}
        >
          By Protocol
        </Button>
      </div>
      <div className="ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          disabled={isClearDisabled}
        >
          Clear Filters
        </Button>
      </div>
    </div>
  )
}
