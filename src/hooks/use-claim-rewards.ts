import * as React from "react"
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit"
import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions"
import BN from "bn.js"
import BigNumber from "bignumber.js"

import type { Protocol, RewardSummaryItem } from "@/lib/market-data"
import {
  CETUS_SLIPPAGE,
  createAggregatorClient,
} from "@/lib/cetus-aggregator"
import { formatTokenSymbol } from "@/lib/market-fetch/utils"
import { hasClaimableRewards, normalizeRewards } from "@/lib/reward-utils"
import type { ClaimResult } from "@/hooks/claim/claim-builders"
import {
  formatAtomicAmount,
  toAtomicAmount,
} from "@/hooks/claim/swap-helpers"

type UseClaimRewardsArgs = {
  summaryRows: RewardSummaryItem[]
  showClaimActions: boolean
  onRefresh: () => void
  swapTargetCoinType: string
  swapTargetDecimals: number | null
  swapTargetSymbol: string
  swapEnabled: boolean
  coinDecimalsMap: Record<string, number>
}

type ClaimBuilders = {
  appendAlphaLendClaim: (tx: Transaction) => Promise<ClaimResult>
  appendNaviClaim: (tx: Transaction) => Promise<ClaimResult>
  appendScallopClaim: (tx: Transaction) => Promise<ClaimResult>
  appendSuilendClaim: (tx: Transaction) => Promise<ClaimResult>
}

export function useClaimRewards({
  summaryRows,
  showClaimActions,
  onRefresh,
  swapTargetCoinType,
  swapTargetDecimals,
  swapTargetSymbol,
  swapEnabled,
  coinDecimalsMap,
}: UseClaimRewardsArgs) {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  const [claimingProtocol, setClaimingProtocol] = React.useState<
    Protocol | "all" | null
  >(null)
  const [claimError, setClaimError] = React.useState<string | null>(null)

  const normalizedSummaryRows = React.useMemo(
    () =>
      summaryRows.map((item) => ({
        ...item,
        rewards: normalizeRewards(item.rewards, coinDecimalsMap),
      })),
    [coinDecimalsMap, summaryRows]
  )
  const findSummary = React.useCallback(
    (protocol: Protocol) =>
      normalizedSummaryRows.find((item) => item.protocol === protocol),
    [normalizedSummaryRows]
  )
  const getRewardsForProtocol = React.useCallback(
    (protocol: Protocol) => findSummary(protocol)?.rewards ?? [],
    [findSummary]
  )
  const suilendClaimRewards = React.useMemo(
    () => findSummary("Suilend")?.claimMeta?.suilend?.rewards ?? [],
    [findSummary]
  )
  const suilendSwapInputs = React.useMemo(
    () => findSummary("Suilend")?.claimMeta?.suilend?.swapInputs ?? [],
    [findSummary]
  )
  const hasClaimableRewardsForProtocol = React.useCallback(
    (protocol: Protocol) =>
      hasClaimableRewards(getRewardsForProtocol(protocol), coinDecimalsMap),
    [coinDecimalsMap, getRewardsForProtocol]
  )
  const hasSuilendClaim =
    suilendClaimRewards.length > 0
    && hasClaimableRewardsForProtocol("Suilend")
  const hasAlphaClaim = hasClaimableRewardsForProtocol("AlphaLend")
  const hasNaviClaim = hasClaimableRewardsForProtocol("Navi")
  const hasScallopClaim = hasClaimableRewardsForProtocol("Scallop")
  const hasAnyClaim =
    showClaimActions
    && (hasSuilendClaim || hasAlphaClaim || hasNaviClaim || hasScallopClaim)

  const isProtocolClaimSupported = React.useCallback(
    (protocol: Protocol) =>
      protocol === "Suilend"
      || protocol === "AlphaLend"
      || protocol === "Navi"
      || protocol === "Scallop",
    []
  )

  const aggregatorClient = React.useMemo(() => {
    if (!account?.address) return null
    return createAggregatorClient(suiClient, account.address)
  }, [account?.address, suiClient])

  const toAtomicAmountWithDecimals = React.useCallback(
    (amount: number, coinType: string) =>
      toAtomicAmount(amount, coinType, coinDecimalsMap),
    [coinDecimalsMap]
  )

  const [swapEstimateLabel, setSwapEstimateLabel] = React.useState<string | null>(
    null
  )
  const [swapPreviewLoading, setSwapPreviewLoading] = React.useState(false)

  const claimBuilderDeps = React.useMemo(
    () => ({
      accountAddress: account?.address,
      suiClient,
      getRewardsForProtocol,
      hasSuilendClaim,
      hasAlphaClaim,
      suilendClaimRewards,
      toAtomicAmount: toAtomicAmountWithDecimals,
    }),
    [
      account?.address,
      getRewardsForProtocol,
      hasAlphaClaim,
      hasSuilendClaim,
      suilendClaimRewards,
      suiClient,
      toAtomicAmountWithDecimals,
    ]
  )
  const claimBuildersRef = React.useRef<Promise<ClaimBuilders> | null>(null)
  React.useEffect(() => {
    claimBuildersRef.current = null
  }, [
    claimBuilderDeps.accountAddress,
    claimBuilderDeps.getRewardsForProtocol,
    claimBuilderDeps.hasAlphaClaim,
    claimBuilderDeps.hasSuilendClaim,
    claimBuilderDeps.suilendClaimRewards,
    claimBuilderDeps.suiClient,
    claimBuilderDeps.toAtomicAmount,
  ])
  const getClaimBuilders = React.useCallback(() => {
    if (!claimBuildersRef.current) {
      claimBuildersRef.current = import("@/hooks/claim/claim-builders").then(
        ({ createClaimBuilders }) => createClaimBuilders(claimBuilderDeps)
      )
    }
    return claimBuildersRef.current
  }, [claimBuilderDeps])

  React.useEffect(() => {
    if (!showClaimActions) {
      setSwapEstimateLabel(null)
      return
    }
    if (!aggregatorClient || !account?.address) {
      setSwapEstimateLabel(null)
      return
    }
    if (!swapEnabled) {
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
    showClaimActions,
    swapEnabled,
    suilendSwapInputs,
    swapTargetCoinType,
    swapTargetDecimals,
    swapTargetSymbol,
  ])

  const getSwapPreview = React.useCallback(async (
    _protocol: Protocol | "all",
    rewards: RewardSummaryItem["rewards"]
  ) => {
    if (!swapEnabled) return null
    if (!aggregatorClient) return null
    setSwapPreviewLoading(true)
    let canSwapAll = true
    try {
      const items: Array<{
        token: string
        amount: number
        coinType?: string
        steps: Array<{ from: string; target: string; provider: string }>
        estimatedOut?: string
        note?: string
      }> = []
      for (const reward of rewards) {
        if (!reward.coinType) {
          items.push({
            token: reward.token,
            amount: reward.amount,
            coinType: reward.coinType,
            steps: [],
            note: "Missing coin type",
          })
          canSwapAll = false
          continue
        }
        if (reward.coinType === swapTargetCoinType) {
          items.push({
            token: reward.token,
            amount: reward.amount,
            coinType: reward.coinType,
            steps: [],
            note: "No swap needed",
            estimatedOut: reward.amount.toLocaleString("en-US", {
              maximumFractionDigits: 12,
            }),
          })
          continue
        }
        const decimals = coinDecimalsMap[reward.coinType] ?? 0
        const amountAtomic = new BN(
          new BigNumber(reward.amount)
            .shiftedBy(decimals)
            .integerValue(BigNumber.ROUND_FLOOR)
            .toString(10)
        )
        if (amountAtomic.isZero()) {
          continue
        }
        const routerResult = await aggregatorClient.findRouters({
          from: reward.coinType,
          target: swapTargetCoinType,
          amount: amountAtomic,
          byAmountIn: true,
        })
        const steps =
          routerResult?.paths?.map((path) => ({
            from: formatTokenSymbol(path.from),
            target: formatTokenSymbol(path.target),
            provider: path.provider,
          })) ?? []
        if (!steps.length) {
          canSwapAll = false
        }
        const estimatedOut =
          swapTargetDecimals !== null && routerResult?.amountOut
            ? formatAtomicAmount(routerResult.amountOut, swapTargetDecimals)
            : undefined
        items.push({
          token: reward.token,
          amount: reward.amount,
          coinType: reward.coinType,
          steps,
          estimatedOut,
        })
      }

      return {
        items,
        targetSymbol: swapTargetSymbol,
        canSwapAll,
      }
    } finally {
      setSwapPreviewLoading(false)
    }
  }, [
    aggregatorClient,
    coinDecimalsMap,
    swapEnabled,
    swapTargetCoinType,
    swapTargetDecimals,
    swapTargetSymbol,
  ])

  const swapAvailable = Boolean(aggregatorClient && swapTargetDecimals !== null)

  const buildSwapFromInputs = React.useCallback(
    async (
      tx: Transaction,
      inputs: Array<{
        coinType: string
        coin: TransactionObjectArgument
        amountAtomic: BN | null
      }>
    ) => {
      if (!aggregatorClient || !account?.address) return null
      const outputCoins: TransactionObjectArgument[] = []
      const swapInputs = inputs.filter(
        (input) =>
          input.coinType !== swapTargetCoinType
          && input.amountAtomic
          && !input.amountAtomic.isZero()
      )
      if (swapInputs.some((input) => !input.amountAtomic)) {
        throw new Error("Missing coin decimals.")
      }
      const targetInputs = inputs.filter(
        (input) => input.coinType === swapTargetCoinType
      )
      targetInputs.forEach((input) => {
        if (input.coin) outputCoins.push(input.coin)
      })
      if (swapInputs.length > 0) {
        const routerResult = await aggregatorClient.findMergeSwapRouters({
          target: swapTargetCoinType,
          byAmountIn: true,
          froms: swapInputs.map((input) => ({
            coinType: input.coinType,
            amount: input.amountAtomic ?? new BN(0),
          })),
          depth: 3,
        })
        if (!routerResult || routerResult.error) {
          throw new Error("Swap route unavailable.")
        }
        const outputCoin = await aggregatorClient.mergeSwap({
          router: routerResult,
          inputCoins: swapInputs.map((input) => ({
            coinType: input.coinType,
            coin: input.coin,
          })),
          slippage: CETUS_SLIPPAGE,
          txb: tx,
        })
        outputCoins.push(outputCoin)
      }
      if (!outputCoins.length) return tx
      const mergedOutput = outputCoins[0]
      if (outputCoins.length > 1) {
        tx.mergeCoins(mergedOutput, outputCoins.slice(1))
      }
      tx.transferObjects([mergedOutput], tx.pure.address(account.address))
      return tx
    },
    [account?.address, aggregatorClient, swapTargetCoinType]
  )

  const transferClaimedCoins = React.useCallback(
    (tx: Transaction, inputs: Array<{ coin: TransactionObjectArgument }>) => {
      if (!account?.address) return
      inputs.forEach((input) => {
        tx.transferObjects([input.coin], tx.pure.address(account.address))
      })
    },
    [account?.address]
  )

  const buildProtocolTransaction = React.useCallback(
    async (protocol: Protocol) => {
      const tx = new Transaction()
      const {
        appendAlphaLendClaim,
        appendNaviClaim,
        appendScallopClaim,
        appendSuilendClaim,
      } = await getClaimBuilders()
      let inputs: Array<{
        coinType: string
        coin: TransactionObjectArgument
        amountAtomic: BN | null
      }> = []
      let hasClaim = false
      if (protocol === "Suilend") {
        const result = await appendSuilendClaim(tx)
        inputs = result.inputs
        hasClaim = result.hasClaim
      } else if (protocol === "Navi") {
        const result = await appendNaviClaim(tx)
        inputs = result.inputs
        hasClaim = result.hasClaim
      } else if (protocol === "Scallop") {
        const result = await appendScallopClaim(tx)
        inputs = result.inputs
        hasClaim = result.hasClaim
      } else if (protocol === "AlphaLend") {
        const result = await appendAlphaLendClaim(tx)
        inputs = result.inputs
        hasClaim = result.hasClaim
      }
      if (inputs.length) {
        inputs = inputs.filter(
          (input) => input.amountAtomic && !input.amountAtomic.isZero()
        )
      }
      if (!hasClaim || !inputs.length) return null
      if (swapEnabled) {
        if (!swapAvailable) {
          throw new Error("Swap not available.")
        }
        await buildSwapFromInputs(tx, inputs)
        return tx
      }
      transferClaimedCoins(tx, inputs)
      return tx
    },
    [
      buildSwapFromInputs,
      getClaimBuilders,
      swapAvailable,
      swapEnabled,
      transferClaimedCoins,
    ]
  )

  const buildClaimAllTransaction = React.useCallback(async () => {
    const tx = new Transaction()
    const {
      appendAlphaLendClaim,
      appendNaviClaim,
      appendScallopClaim,
      appendSuilendClaim,
    } = await getClaimBuilders()
    const inputs: Array<{
      coinType: string
      coin: TransactionObjectArgument
      amountAtomic: BN | null
    }> = []
    let hasClaim = false
    if (hasSuilendClaim) {
      const result = await appendSuilendClaim(tx)
      inputs.push(...result.inputs)
      hasClaim = hasClaim || result.hasClaim
    }
    if (hasNaviClaim) {
      const result = await appendNaviClaim(tx)
      inputs.push(...result.inputs)
      hasClaim = hasClaim || result.hasClaim
    }
    if (hasScallopClaim) {
      const result = await appendScallopClaim(tx)
      inputs.push(...result.inputs)
      hasClaim = hasClaim || result.hasClaim
    }
    if (hasAlphaClaim) {
      const result = await appendAlphaLendClaim(tx)
      inputs.push(...result.inputs)
      hasClaim = hasClaim || result.hasClaim
    }
    const filteredInputs = inputs.filter(
      (input) => input.amountAtomic && !input.amountAtomic.isZero()
    )
    if (!hasClaim || !filteredInputs.length) return null
    if (swapEnabled) {
      if (!swapAvailable) {
        throw new Error("Swap not available.")
      }
      await buildSwapFromInputs(tx, filteredInputs)
      return tx
    }
    transferClaimedCoins(tx, filteredInputs)
    return tx
  }, [
    buildSwapFromInputs,
    getClaimBuilders,
    hasAlphaClaim,
    hasNaviClaim,
    hasScallopClaim,
    hasSuilendClaim,
    swapAvailable,
    swapEnabled,
    transferClaimedCoins,
  ])

  const handleClaimProtocol = React.useCallback(
    async (protocol: Protocol) => {
      if (!showClaimActions) return
      setClaimingProtocol(protocol)
      setClaimError(null)
      try {
        const transaction = await buildProtocolTransaction(protocol)
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
    [buildProtocolTransaction, onRefresh, showClaimActions, signAndExecuteTransaction]
  )

  const handleClaimAll = React.useCallback(async () => {
    if (!showClaimActions) return
    if (!hasAnyClaim) return
    setClaimingProtocol("all")
    setClaimError(null)
    try {
      const transaction = await buildClaimAllTransaction()
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
    buildClaimAllTransaction,
    hasAnyClaim,
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
    getSwapPreview,
    swapPreviewLoading,
    setSwapPreviewLoading,
    swapAvailable,
  }
}
