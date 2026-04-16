import * as React from "react"
import {
  useCurrentAccount,
  useDAppKit,
  useWalletConnection,
  useWallets,
} from "@mysten/dapp-kit-react"

import { Button } from "@/components/ui/button"
import { ThemeMenu } from "@/components/ThemeMenu"
import { WalletPanel } from "@/components/WalletPanel"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Header() {
  const dAppKit = useDAppKit()
  const account = useCurrentAccount()
  const connection = useWalletConnection()
  const wallets = useWallets()
  const [walletAction, setWalletAction] = React.useState<
    "connect" | "disconnect" | null
  >(null)
  const previewAddress = React.useMemo(() => {
    if (typeof window === "undefined") return null
    const value = new URLSearchParams(window.location.search).get("address")
    return value && value.startsWith("0x") ? value : null
  }, [])
  const displayAddress = previewAddress ?? account?.address
  const isConnecting =
    connection.isConnecting
    || connection.isReconnecting
    || walletAction === "connect"
  const isDisconnecting = walletAction === "disconnect"

  const handleConnectWallet = React.useCallback(async (
    wallet: (typeof wallets)[number]
  ) => {
    setWalletAction("connect")
    try {
      await dAppKit.connectWallet({ wallet })
    } catch (error) {
      console.error("Connect wallet failed:", error)
    } finally {
      setWalletAction(null)
    }
  }, [dAppKit])

  const handleDisconnectWallet = React.useCallback(async () => {
    setWalletAction("disconnect")
    try {
      await dAppKit.disconnectWallet()
    } catch (error) {
      console.error("Disconnect wallet failed:", error)
    } finally {
      setWalletAction(null)
    }
  }, [dAppKit])

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Sui Lending Dashboard</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <WalletPanel address={displayAddress} />
        {account?.address ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDisconnectWallet()}
            disabled={isDisconnecting}
          >
            Disconnect
          </Button>
        ) : displayAddress ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isConnecting}>
                Connect
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Wallets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {wallets.length ? (
                wallets.map((wallet) => (
                  <DropdownMenuItem
                    key={wallet.name}
                    onClick={() => void handleConnectWallet(wallet)}
                  >
                    {wallet.name}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No wallets found</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ThemeMenu />
      </div>
    </>
  )
}
