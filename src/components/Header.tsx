import * as React from "react"
import { ConnectModal, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react"

import { Button } from "@/components/ui/button"
import { ThemeMenu } from "@/components/ThemeMenu"
import { WalletPanel } from "@/components/WalletPanel"

export function Header() {
  const modalRef = React.useRef<React.ElementRef<typeof ConnectModal> | null>(null)
  const account = useCurrentAccount()
  const dAppKit = useDAppKit()
  const handleOpenConnect = () => {
    const modal = modalRef.current as { show?: () => void; open?: boolean } | null
    if (!modal) return
    if (typeof modal.show === "function") {
      modal.show()
      return
    }
    modal.open = true
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Sui Lending Dashboard</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <WalletPanel />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (account?.address) {
              dAppKit.disconnectWallet().catch(() => null)
              return
            }
            handleOpenConnect()
          }}
        >
          {account?.address ? "Disconnect" : "Connect"}
        </Button>
        <ThemeMenu />
      </div>
      <ConnectModal ref={modalRef} />
    </>
  )
}
