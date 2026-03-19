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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FilterIcon />
            Assets ({selectedAssets.length || "All"})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Assets</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {assetOptions.map((asset) => (
            <DropdownMenuCheckboxItem
              key={asset}
              checked={selectedAssets.includes(asset)}
              onCheckedChange={() => onToggleAsset(asset)}
            >
              {asset}
            </DropdownMenuCheckboxItem>
          ))}
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
