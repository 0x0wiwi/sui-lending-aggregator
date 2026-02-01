import { Button } from "@/components/ui/button"
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
}: RewardSummaryCardProps) {
  const hasSummaryData = summaryRows.some(
    (item) => item.supplies.length > 0 || item.rewards.length > 0
  )

  return (
    <div className="rounded-lg border bg-muted/20 p-3 text-xs">
      <div className="mb-2 font-semibold text-muted-foreground uppercase">
        Reward Summary
      </div>
      {!displayAddress ? (
        <div className="text-muted-foreground">Connect a wallet to view rewards.</div>
      ) : hasSummaryData ? (
        <div className="grid gap-2">
          <div className="overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-1">Protocol</th>
                  <th className="px-2 py-1">Supplied Assets</th>
                  <th className="px-2 py-1">Rewards</th>
                  {showClaimActions && <th className="px-2 py-1">Action</th>}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((item) => (
                  <tr key={item.protocol} className="border-b last:border-b-0">
                    <td className="px-2 py-1 font-medium">{item.protocol}</td>
                    <td className="px-2 py-1 align-top">
                      {renderSupplyList(item.supplies)}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {renderRewardList(item.rewards)}
                    </td>
                    {showClaimActions && (
                      <td className="px-2 py-1 align-top whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
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
                          {claimingProtocol === item.protocol ? "Claiming..." : "Claim"}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="border-t bg-muted/30">
                  <td className="px-2 py-1 font-medium">Total</td>
                  <td className="px-2 py-1 align-top">
                    {renderSupplyList(totalSupplyList)}
                  </td>
                  <td className="px-2 py-1 align-top">
                    {renderRewardList(totalRewardList)}
                  </td>
                  {showClaimActions && (
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={onClaimAll}
                        disabled={claimingProtocol !== null || !hasAnyClaim}
                      >
                        {claimingProtocol === "all" ? "Claiming..." : "Claim All"}
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
