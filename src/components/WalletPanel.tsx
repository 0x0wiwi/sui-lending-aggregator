import { CopyIcon } from "lucide-react"
import { useCurrentAccount } from "@mysten/dapp-kit-react"

import { Button } from "@/components/ui/button"

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletPanel() {
  const account = useCurrentAccount()

  if (!account?.address) {
    return null
  }

  const handleCopy = async () => {
    if (!account?.address) return
    await navigator.clipboard.writeText(account.address)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 items-center gap-2 rounded-none border px-2 text-xs">
        <span>{formatAddress(account.address)}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          aria-label="Copy address"
        >
          <CopyIcon className="pointer-events-none" />
        </Button>
      </div>
    </div>
  )
}
