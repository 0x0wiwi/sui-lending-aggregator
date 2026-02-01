import { Button } from "@/components/ui/button"
import { FiltersBar } from "@/components/FiltersBar"

type MarketToolbarProps = {
  selectedAssets: string[]
  selectedProtocols: string[]
  onlyIncentive: boolean
  onlyPosition: boolean
  viewMode: "mixed" | "byAsset" | "byProtocol"
  onToggleAsset: (asset: string) => void
  onToggleProtocol: (protocol: string) => void
  onToggleIncentive: () => void
  onTogglePosition: () => void
  onClearFilters: () => void
  onChangeView: (view: "mixed" | "byAsset" | "byProtocol") => void
}

export function MarketToolbar({
  selectedAssets,
  selectedProtocols,
  onlyIncentive,
  onlyPosition,
  viewMode,
  onToggleAsset,
  onToggleProtocol,
  onToggleIncentive,
  onTogglePosition,
  onClearFilters,
  onChangeView,
}: MarketToolbarProps) {
  const isClearDisabled =
    !selectedAssets.length
    && !selectedProtocols.length
    && !onlyIncentive
    && !onlyPosition
    && viewMode === "mixed"

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FiltersBar
        selectedAssets={selectedAssets}
        selectedProtocols={selectedProtocols}
        onlyIncentive={onlyIncentive}
        onlyPosition={onlyPosition}
        onToggleAsset={onToggleAsset}
        onToggleProtocol={onToggleProtocol}
        onToggleIncentive={onToggleIncentive}
        onTogglePosition={onTogglePosition}
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
