import * as React from "react"
import {
  useConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useWallets,
} from "@mysten/dapp-kit"

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
  const account = useCurrentAccount()
  const wallets = useWallets()
  const previewAddress = React.useMemo(() => {
    if (typeof window === "undefined") return null
    const value = new URLSearchParams(window.location.search).get("address")
    return value && value.startsWith("0x") ? value : null
  }, [])
  const displayAddress = previewAddress ?? account?.address
  const { mutate: connectWallet, isPending: isConnecting } =
    useConnectWallet()
  const { mutate: disconnectWallet, isPending: isDisconnecting } =
    useDisconnectWallet()
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
            onClick={() => disconnectWallet()}
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
                    onClick={() => connectWallet({ wallet })}
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
