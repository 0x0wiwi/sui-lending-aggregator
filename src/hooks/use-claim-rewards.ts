import * as React from "react"
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { AlphalendClient, getUserPositionCapId } from "@alphafi/alphalend-sdk"
import {
  LENDING_MARKET_ID,
  LENDING_MARKET_TYPE,
  SuilendClient,
} from "@suilend/sdk/client"
import { PACKAGE_ID } from "@suilend/sdk/_generated/suilend"

import type { Protocol, RewardSummaryItem } from "@/lib/market-data"

type UseClaimRewardsArgs = {
  summaryRows: RewardSummaryItem[]
  showClaimActions: boolean
  onRefresh: () => void
}

export function useClaimRewards({
  summaryRows,
  showClaimActions,
  onRefresh,
}: UseClaimRewardsArgs) {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  const [claimingProtocol, setClaimingProtocol] = React.useState<
    Protocol | "all" | null
  >(null)
  const [claimError, setClaimError] = React.useState<string | null>(null)

  const findSummary = React.useCallback(
    (protocol: Protocol) => summaryRows.find((item) => item.protocol === protocol),
    [summaryRows]
  )
  const suilendClaimRewards = React.useMemo(
    () => findSummary("Suilend")?.claimMeta?.suilend?.rewards ?? [],
    [findSummary]
  )
  const alphaClaimRewards = React.useMemo(
    () => findSummary("AlphaLend")?.rewards ?? [],
    [findSummary]
  )
  const hasSuilendClaim = suilendClaimRewards.length > 0
  const hasAlphaClaim = alphaClaimRewards.length > 0
  const hasAnyClaim = showClaimActions && (hasSuilendClaim || hasAlphaClaim)

  const isProtocolClaimSupported = React.useCallback(
    (protocol: Protocol) => protocol === "Suilend" || protocol === "AlphaLend",
    []
  )

  const buildSuilendClaimTransaction = React.useCallback(
    async (transaction?: Transaction) => {
      if (!account?.address) return null
      if (!hasSuilendClaim) return transaction ?? null
      const suilendClient = await SuilendClient.initialize(
        LENDING_MARKET_ID,
        LENDING_MARKET_TYPE,
        suiClient
      )
      const ownerCaps = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${PACKAGE_ID}::lending_market::ObligationOwnerCap<${suilendClient.lendingMarket.$typeArgs[0]}>`,
        },
        options: {
          showContent: true,
        },
      })
      const obligationOwnerCapId = ownerCaps.data[0]?.data?.objectId
      if (!obligationOwnerCapId) {
        throw new Error("Missing obligation owner cap.")
      }
      const tx = transaction ?? new Transaction()
      suilendClient.claimRewardsAndSendToUser(
        account.address,
        obligationOwnerCapId,
        suilendClaimRewards,
        tx
      )
      return tx
    },
    [account?.address, hasSuilendClaim, suilendClaimRewards, suiClient]
  )

  const buildAlphaLendClaimTransaction = React.useCallback(async () => {
    if (!account?.address) return null
    if (!hasAlphaClaim) return null
    const positionCapId = await getUserPositionCapId(
      suiClient,
      "mainnet",
      account.address
    )
    if (!positionCapId) {
      throw new Error("Missing AlphaLend position cap.")
    }
    const alphalendClient = new AlphalendClient("mainnet", suiClient)
    return alphalendClient.claimRewards({
      address: account.address,
      positionCapId,
      claimAndDepositAlpha: false,
      claimAndDepositAll: false,
    })
  }, [account?.address, hasAlphaClaim, suiClient])

  const handleClaimProtocol = React.useCallback(
    async (protocol: Protocol) => {
      if (!showClaimActions) return
      setClaimingProtocol(protocol)
      setClaimError(null)
      try {
        let transaction: Transaction | null = null
        if (protocol === "AlphaLend") {
          transaction = await buildAlphaLendClaimTransaction()
        } else if (protocol === "Suilend") {
          transaction = await buildSuilendClaimTransaction()
        }
        if (!transaction) {
          throw new Error("Claim not available.")
        }
        await signAndExecuteTransaction({ transaction })
        onRefresh()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Claim failed."
        setClaimError(message)
      } finally {
        setClaimingProtocol(null)
      }
    },
    [
      buildAlphaLendClaimTransaction,
      buildSuilendClaimTransaction,
      onRefresh,
      showClaimActions,
      signAndExecuteTransaction,
    ]
  )

  const handleClaimAll = React.useCallback(async () => {
    if (!showClaimActions) return
    if (!hasAnyClaim) return
    setClaimingProtocol("all")
    setClaimError(null)
    try {
      let transaction: Transaction | null = null
      if (hasAlphaClaim) {
        transaction = await buildAlphaLendClaimTransaction()
      }
      if (hasSuilendClaim) {
        transaction = await buildSuilendClaimTransaction(transaction ?? undefined)
      }
      if (!transaction) {
        throw new Error("Claim not available.")
      }
      await signAndExecuteTransaction({ transaction })
      onRefresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Claim failed."
      setClaimError(message)
    } finally {
      setClaimingProtocol(null)
    }
  }, [
    buildAlphaLendClaimTransaction,
    buildSuilendClaimTransaction,
    hasAlphaClaim,
    hasAnyClaim,
    hasSuilendClaim,
    onRefresh,
    showClaimActions,
    signAndExecuteTransaction,
  ])

  return {
    claimError,
    claimingProtocol,
    handleClaimAll,
    handleClaimProtocol,
    hasAnyClaim,
    isProtocolClaimSupported,
  }
}
