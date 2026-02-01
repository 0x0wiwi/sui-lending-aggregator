import { CopyIcon } from "lucide-react"
import { useCurrentAccount } from "@mysten/dapp-kit"

import { Button } from "@/components/ui/button"

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

type WalletPanelProps = {
  address?: string | null
}

export function WalletPanel({ address }: WalletPanelProps) {
  const account = useCurrentAccount()
  const displayAddress = address ?? account?.address

  if (!displayAddress) {
    return null
  }

  const handleCopy = async () => {
    if (!displayAddress) return
    try {
      await navigator.clipboard.writeText(displayAddress)
    } catch (error) {
      console.error("Copy address failed:", error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-8 items-center gap-2 rounded-none border px-2 text-xs">
        <span>{formatAddress(displayAddress)}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          aria-label="Copy address"
          className="cursor-pointer"
        >
          <CopyIcon className="pointer-events-none" />
        </Button>
      </div>
    </div>
  )
}
