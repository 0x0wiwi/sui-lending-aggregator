import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Protocol, RewardSummaryItem } from "@/lib/market-data"

type RewardSummaryCardProps = {
  displayAddress?: string | null
  summaryRows: RewardSummaryItem[]
  totalSupplyList: { asset: string; amount: number }[]
  totalRewardList: { token: string; amount: number }[]
  showClaimActions: boolean
  claimError: string | null
  claimingProtocol: Protocol | "all" | null
  hasAnyClaim: boolean
  onClaimProtocol: (protocol: Protocol) => void
  onClaimAll: () => void
  isProtocolClaimSupported: (protocol: Protocol) => boolean
  swapTargetCoinType: string
  swapTargetOptions: Array<{ label: string; coinType: string }>
  onSwapTargetChange: (coinType: string) => void
  slippageLabel: string
  swapEstimateLabel: string | null
  swapEnabled: boolean
  onSwapEnabledChange: (enabled: boolean) => void
  swapAvailable: boolean
}

function formatAmount(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 12,
  })
}

function renderAlignedNumber(value: number) {
  const formatted = formatAmount(value)
  const [whole, fraction] = formatted.split(".")
  return (
    <span className="inline-flex items-baseline tabular-nums">
      <span className="min-w-[6ch] text-right">{whole}</span>
      <span className="min-w-[1ch] text-left text-xs text-muted-foreground">
        {fraction ? `.${fraction}` : ""}
      </span>
    </span>
  )
}

function renderSupplyList(supplies: { asset: string; amount: number }[]) {
  if (!supplies.length) return "—"
  return (
    <div className="grid gap-1">
      {supplies.map((item) => (
        <div key={item.asset} className="grid grid-cols-[5ch_1fr] items-baseline gap-3">
          <span className="font-medium">{item.asset}</span>
          <span>{renderAlignedNumber(item.amount)}</span>
        </div>
      ))}
    </div>
  )
}

function renderRewardList(rewards: { token: string; amount: number }[]) {
  if (!rewards.length) return "—"
  return (
    <div className="grid gap-1">
      {rewards.map((item) => (
        <div key={item.token} className="grid grid-cols-[5ch_1fr] items-baseline gap-3">
          <span className="font-medium">{item.token}</span>
          <span>{renderAlignedNumber(item.amount)}</span>
        </div>
      ))}
    </div>
  )
}

export function RewardSummaryCard({
  displayAddress,
  summaryRows,
  totalSupplyList,
  totalRewardList,
  showClaimActions,
  claimError,
  claimingProtocol,
  hasAnyClaim,
  onClaimProtocol,
  onClaimAll,
  isProtocolClaimSupported,
  swapTargetCoinType,
  swapTargetOptions,
  onSwapTargetChange,
  slippageLabel,
  swapEstimateLabel,
  swapEnabled,
  onSwapEnabledChange,
  swapAvailable,
}: RewardSummaryCardProps) {
  const hasSummaryData = summaryRows.some(
    (item) => item.supplies.length > 0 || item.rewards.length > 0
  )
  const selectedTarget =
    swapTargetOptions.find((option) => option.coinType === swapTargetCoinType)
      ?.label ?? "Select"

  return (
    <div className="rounded-lg border bg-muted/20 p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-muted-foreground uppercase">
          Reward Summary
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Button
              variant={swapEnabled ? "outline" : "secondary"}
              size="sm"
              onClick={() => onSwapEnabledChange(false)}
            >
              Claim
            </Button>
            <Button
              variant={swapEnabled ? "secondary" : "outline"}
              size="sm"
              disabled={!swapAvailable}
              onClick={() => onSwapEnabledChange(true)}
            >
              Claim + Swap
            </Button>
          </div>
          {swapEnabled && swapAvailable ? (
            <>
              <span>Swap to</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {selectedTarget}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {swapTargetOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.coinType}
                      onClick={() => onSwapTargetChange(option.coinType)}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span>Slippage {slippageLabel}</span>
              {swapEstimateLabel ? (
                <span>Estimated receive {swapEstimateLabel}</span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {!displayAddress ? (
        <div className="text-muted-foreground">Connect a wallet to view rewards.</div>
      ) : hasSummaryData ? (
        <div className="grid gap-2">
          <div className="grid gap-2 md:hidden">
            {summaryRows.map((item) => (
              <div key={item.protocol} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{item.protocol}</div>
                  {showClaimActions && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full min-w-0"
                      onClick={() => onClaimProtocol(item.protocol)}
                      disabled={
                        claimingProtocol !== null
                        || !item.rewards.length
                        || !isProtocolClaimSupported(item.protocol)
                      }
                      title={
                        !isProtocolClaimSupported(item.protocol)
                          ? "Claim not available"
                          : undefined
                      }
                    >
                      {claimingProtocol === item.protocol
                        ? "Claiming..."
                        : swapEnabled
                          ? "Claim + Swap"
                          : "Claim"}
                    </Button>
                  )}
                </div>
                <div className="mt-2 grid gap-2">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Supplied Assets</div>
                    {renderSupplyList(item.supplies)}
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Rewards</div>
                    {renderRewardList(item.rewards)}
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Total</div>
                {showClaimActions && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full min-w-0"
                    onClick={onClaimAll}
                    disabled={claimingProtocol !== null || !hasAnyClaim}
                  >
                    {claimingProtocol === "all"
                      ? "Claiming..."
                      : swapEnabled
                        ? "Claim + Swap All"
                        : "Claim All"}
                  </Button>
                )}
              </div>
              <div className="mt-2 grid gap-2">
                <div>
                  <div className="text-[11px] text-muted-foreground">Supplied Assets</div>
                  {renderSupplyList(totalSupplyList)}
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Rewards</div>
                  {renderRewardList(totalRewardList)}
                </div>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[38%]" />
                <col className="w-[38%]" />
                {showClaimActions && <col className="w-[8%]" />}
              </colgroup>
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-1">Protocol</th>
                  <th className="px-2 py-1">Supplied Assets</th>
                  <th className="px-2 py-1">Rewards</th>
                  {showClaimActions && (
                    <th className="px-2 py-1 text-right w-[140px]">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((item) => (
                  <tr key={item.protocol} className="border-b last:border-b-0">
                    <td className="px-2 py-1 font-medium">{item.protocol}</td>
                    <td className="px-2 py-1 align-top whitespace-normal">
                      {renderSupplyList(item.supplies)}
                    </td>
                    <td className="px-2 py-1 align-top whitespace-normal">
                      {renderRewardList(item.rewards)}
                    </td>
                    {showClaimActions && (
                      <td className="px-2 py-1 align-top whitespace-nowrap text-right w-[140px]">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full min-w-0"
                          onClick={() => onClaimProtocol(item.protocol)}
                          disabled={
                            claimingProtocol !== null
                            || !item.rewards.length
                            || !isProtocolClaimSupported(item.protocol)
                          }
                          title={
                            !isProtocolClaimSupported(item.protocol)
                              ? "Claim not available"
                              : undefined
                          }
                        >
                          {claimingProtocol === item.protocol
                            ? "Claiming..."
                            : swapEnabled
                              ? "Claim + Swap"
                              : "Claim"}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="border-t bg-muted/30">
                  <td className="px-2 py-1 font-medium">Total</td>
                  <td className="px-2 py-1 align-top whitespace-normal">
                    {renderSupplyList(totalSupplyList)}
                  </td>
                  <td className="px-2 py-1 align-top whitespace-normal">
                    {renderRewardList(totalRewardList)}
                  </td>
                  {showClaimActions && (
                    <td className="px-2 py-1 align-top whitespace-nowrap text-right w-[140px]">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full min-w-0"
                        onClick={onClaimAll}
                        disabled={claimingProtocol !== null || !hasAnyClaim}
                      >
                        {claimingProtocol === "all"
                          ? "Claiming..."
                          : swapEnabled
                            ? "Claim + Swap All"
                            : "Claim All"}
                      </Button>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          {claimError && showClaimActions && (
            <div className="text-xs text-destructive">{claimError}</div>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground">No rewards detected.</div>
      )}
    </div>
  )
}
