import * as React from "react"
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import BN from "bn.js"
import BigNumber from "bignumber.js"
import {
  LENDING_MARKET_ID,
  LENDING_MARKET_TYPE,
  SuilendClient,
} from "@suilend/sdk/client"
import { PACKAGE_ID } from "@suilend/sdk/_generated/suilend"

import type { Protocol, RewardSummaryItem } from "@/lib/market-data"
import {
  CETUS_SLIPPAGE,
  createAggregatorClient,
} from "@/lib/cetus-aggregator"

type UseClaimRewardsArgs = {
  summaryRows: RewardSummaryItem[]
  showClaimActions: boolean
  onRefresh: () => void
  swapTargetCoinType: string
  swapTargetDecimals: number | null
  swapTargetSymbol: string
}

export function useClaimRewards({
  summaryRows,
  showClaimActions,
  onRefresh,
  swapTargetCoinType,
  swapTargetDecimals,
  swapTargetSymbol,
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
  const suilendSwapInputs = React.useMemo(
    () => findSummary("Suilend")?.claimMeta?.suilend?.swapInputs ?? [],
    [findSummary]
  )
  const hasSuilendClaim = suilendClaimRewards.length > 0
  const hasAnyClaim = showClaimActions && hasSuilendClaim

  const isProtocolClaimSupported = React.useCallback(
    (protocol: Protocol) => protocol === "Suilend",
    []
  )

  const aggregatorClient = React.useMemo(() => {
    if (!account?.address) return null
    return createAggregatorClient(suiClient, account.address)
  }, [account?.address, suiClient])

  const formatAtomicAmount = React.useCallback(
    (amount: BN, decimals: number) => {
      const raw = amount.toString(10)
      if (decimals <= 0) return raw
      const padded = raw.padStart(decimals + 1, "0")
      const whole = padded.slice(0, -decimals)
      let fraction = padded.slice(-decimals)
      fraction = fraction.replace(/0+$/, "")
      if (!fraction) return whole
      const limited = fraction.slice(0, 12)
      return `${whole}.${limited}`
    },
    []
  )

  const [swapEstimateLabel, setSwapEstimateLabel] = React.useState<string | null>(
    null
  )

  React.useEffect(() => {
    if (!showClaimActions) {
      setSwapEstimateLabel(null)
      return
    }
    if (!aggregatorClient || !account?.address) {
      setSwapEstimateLabel(null)
      return
    }
    if (swapTargetDecimals === null) {
      setSwapEstimateLabel(null)
      return
    }
    const swapInputs = suilendSwapInputs.filter(
      (input) => input.coinType !== swapTargetCoinType
    )
    const directTargetAmount =
      findSummary("Suilend")?.rewards.find(
        (reward) => reward.token === swapTargetSymbol
      )?.amount ?? 0
    if (!swapInputs.length && directTargetAmount <= 0) {
      setSwapEstimateLabel("—")
      return
    }
    let isActive = true
    const run = async () => {
      let swapAmount = new BigNumber(0)
      if (swapInputs.length) {
        const routerResult = await aggregatorClient.findMergeSwapRouters({
          target: swapTargetCoinType,
          byAmountIn: true,
          froms: swapInputs.map((input) => ({
            coinType: input.coinType,
            amount: new BN(input.amountAtomic),
          })),
          depth: 3,
        })
        if (routerResult && !routerResult.error) {
          const formatted = formatAtomicAmount(
            routerResult.totalAmountOut,
            swapTargetDecimals
          )
          swapAmount = new BigNumber(formatted)
        }
      }
      const total = swapAmount.plus(directTargetAmount)
      if (!isActive) return
      setSwapEstimateLabel(`${total.toString()} ${swapTargetSymbol}`)
    }
    run().catch((error) => {
      console.error("Swap estimate failed:", error)
      if (isActive) {
        setSwapEstimateLabel("—")
      }
    })
    return () => {
      isActive = false
    }
  }, [
    account?.address,
    aggregatorClient,
    findSummary,
    formatAtomicAmount,
    showClaimActions,
    suilendSwapInputs,
    swapTargetCoinType,
    swapTargetDecimals,
    swapTargetSymbol,
  ])

  const buildSuilendClaimTransaction = React.useCallback(async () => {
      if (!account?.address) return null
      if (!hasSuilendClaim) return null
      if (!aggregatorClient) return null
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
      const tx = new Transaction()
      const { mergedCoinsMap } = suilendClient.claimRewards(
        account.address,
        obligationOwnerCapId,
        suilendClaimRewards,
        tx
      )
      const swapInputs = suilendSwapInputs.filter(
        (input) => input.coinType !== swapTargetCoinType
      )
      const swapCoins = swapInputs.map((input) => ({
        coinType: input.coinType,
        coin: mergedCoinsMap[input.coinType],
        amount: new BN(input.amountAtomic),
      }))
      const outputCoins = []
      const targetCoins = Object.entries(mergedCoinsMap)
        .filter(([coinType]) => coinType === swapTargetCoinType)
        .map(([, coin]) => coin)
      outputCoins.push(...targetCoins)
      if (swapCoins.length > 0) {
        if (swapCoins.some((input) => !input.coin)) {
          throw new Error("Missing swap coin.")
        }
        const routerResult = await aggregatorClient.findMergeSwapRouters({
          target: swapTargetCoinType,
          byAmountIn: true,
          froms: swapCoins.map((input) => ({
            coinType: input.coinType,
            amount: input.amount,
          })),
          depth: 3,
        })
        if (!routerResult || routerResult.error) {
          throw new Error("Swap route unavailable.")
        }
        const outputCoin = await aggregatorClient.mergeSwap({
          router: routerResult,
          inputCoins: swapCoins.map((input) => ({
            coinType: input.coinType,
            coin: input.coin,
          })),
          slippage: CETUS_SLIPPAGE,
          txb: tx,
        })
        outputCoins.push(outputCoin)
      }
      if (!outputCoins.length) {
        return tx
      }
      const mergedOutput = outputCoins[0]
      if (outputCoins.length > 1) {
        tx.mergeCoins(mergedOutput, outputCoins.slice(1))
      }
      tx.transferObjects([mergedOutput], tx.pure.address(account.address))
      return tx
    },
    [
      account?.address,
      aggregatorClient,
      hasSuilendClaim,
      suilendClaimRewards,
      suilendSwapInputs,
      suiClient,
      swapTargetCoinType,
    ]
  )

  const handleClaimProtocol = React.useCallback(
    async (protocol: Protocol) => {
      if (!showClaimActions) return
      setClaimingProtocol(protocol)
      setClaimError(null)
      try {
        let transaction: Transaction | null = null
        if (protocol === "Suilend") {
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
      if (hasSuilendClaim) {
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
  }, [
    buildSuilendClaimTransaction,
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
    swapEstimateLabel,
  }
}
