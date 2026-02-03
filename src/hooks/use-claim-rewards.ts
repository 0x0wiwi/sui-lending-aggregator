import * as React from "react"
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit"
import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions"
import BN from "bn.js"
import BigNumber from "bignumber.js"
import { AlphalendClient, getUserPositionCapId } from "@alphafi/alphalend-sdk"
import {
  claimLendingRewardsPTB,
  getUserAvailableLendingRewards,
} from "@naviprotocol/lending"
import { ScallopBuilder } from "@scallop-io/sui-scallop-sdk"
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
import { formatTokenSymbol } from "@/lib/market-fetch/utils"

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

async function getAlphaLendPositionId(
  client: ReturnType<typeof useSuiClient>,
  constants: AlphalendClient["constants"],
  address: string
) {
  const response = await client.getOwnedObjects({
    owner: address,
    options: { showContent: true },
    filter: { StructType: constants.POSITION_CAP_TYPE },
  })
  const cap = response.data[0]?.data as
    | { content?: { fields?: { position_id?: string } } }
    | undefined
  return cap?.content?.fields?.position_id ?? null
}

async function getAlphaLendRewardInput(
  client: ReturnType<typeof useSuiClient>,
  constants: AlphalendClient["constants"],
  address: string
) {
  type RewardDistributorEntry = {
    fields: {
      market_id: string
      is_deposit: boolean
      last_updated: string
      share: string
      rewards: Array<{
        fields?: {
          earned_rewards?: { fields?: { value?: string } }
          cummulative_rewards_per_share?: { fields?: { value?: string } }
        }
      }>
    }
  }
  type PositionFields = {
    reward_distributors?: RewardDistributorEntry[]
  }
  type MarketReward = {
    fields: {
      coin_type: { fields: { name: string } }
      end_time: string
      start_time: string
      cummulative_rewards_per_share: { fields: { value: string } }
    }
  }
  type MarketRewardDistributor = {
    rewards: MarketReward[]
  }
  type MarketFields = {
    deposit_reward_distributor?: { fields?: MarketRewardDistributor }
    borrow_reward_distributor?: { fields?: MarketRewardDistributor }
  }

  const positionId = await getAlphaLendPositionId(client, constants, address)
  if (!positionId) return []
  const position = await client.getDynamicFieldObject({
    parentId: constants.POSITION_TABLE_ID,
    name: {
      type: "0x2::object::ID",
      value: positionId,
    },
  })
  const positionFields = (position.data as {
    content?: { fields?: { value?: { fields?: PositionFields } } }
  })?.content?.fields?.value?.fields
  const rewardDistributors = positionFields?.reward_distributors ?? []
  const rewardInput: { marketId: number; coinTypes: string[] }[] = []
  const marketActionMap: Map<number, string[]> = new Map()

  const getRewardDistributor = async (
    marketId: number,
    isDeposit: boolean
  ) => {
    const market = await client.getDynamicFieldObject({
      parentId: constants.MARKETS_TABLE_ID,
      name: {
        type: "u64",
        value: marketId.toString(),
      },
    })
    const marketFields = (market.data as {
      content?: { fields?: { value?: { fields?: MarketFields } } }
    })?.content?.fields?.value?.fields
    if (!marketFields) return null
    return isDeposit
      ? marketFields.deposit_reward_distributor?.fields
      : marketFields.borrow_reward_distributor?.fields
  }

  for (const rewardDistributor of rewardDistributors) {
    const marketId = Number(rewardDistributor.fields.market_id)
    const coinTypes: Set<string> = new Set(marketActionMap.get(marketId) || [])
    const lastUpdated = rewardDistributor.fields.last_updated
    const marketRewardDistributorObj = await getRewardDistributor(
      marketId,
      rewardDistributor.fields.is_deposit
    )
    const userRewardDistributorObj = rewardDistributor.fields.rewards
    if (!marketRewardDistributorObj) continue

    for (let i = 0; i < marketRewardDistributorObj.rewards.length; i += 1) {
      const marketReward = marketRewardDistributorObj.rewards[i]
      if (!marketReward) continue
      const userReward =
        i < userRewardDistributorObj.length
          ? userRewardDistributorObj[i]
          : null

      const timeElapsed =
        Math.min(Number(marketReward.fields.end_time), Date.now())
        - Math.max(Number(marketReward.fields.start_time), Number(lastUpdated))

      const userRewardFields = userReward?.fields
      const share = Number(rewardDistributor.fields.share)

      if (timeElapsed > 0 && share > 0) {
        coinTypes.add(marketReward.fields.coin_type.fields.name)
      } else if (userReward && userRewardFields) {
        const earnedValue = Number(
          userRewardFields?.earned_rewards?.fields?.value ?? 0
        )
        if (earnedValue !== 0) {
          coinTypes.add(marketReward.fields.coin_type.fields.name)
        } else if (
          Number(marketReward.fields.cummulative_rewards_per_share.fields.value)
            > Number(
              userRewardFields?.cummulative_rewards_per_share?.fields?.value ?? 0
            )
          && share > 0
        ) {
          coinTypes.add(marketReward.fields.coin_type.fields.name)
        }
      } else if (
        share > 0
        && Number(marketReward.fields.cummulative_rewards_per_share.fields.value) > 0
      ) {
        coinTypes.add(marketReward.fields.coin_type.fields.name)
      }
    }
    marketActionMap.set(marketId, [...coinTypes])
  }

  for (const [marketId, coinTypes] of marketActionMap.entries()) {
    rewardInput.push({ marketId, coinTypes })
  }

  return rewardInput
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

  const findSummary = React.useCallback(
    (protocol: Protocol) => summaryRows.find((item) => item.protocol === protocol),
    [summaryRows]
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
  const hasSuilendClaim = suilendClaimRewards.length > 0
  const hasAlphaClaim = getRewardsForProtocol("AlphaLend").some(
    (reward) => reward.amount > 0
  )
  const hasNaviClaim = getRewardsForProtocol("Navi").some(
    (reward) => reward.amount > 0
  )
  const hasScallopClaim = getRewardsForProtocol("Scallop").some(
    (reward) => reward.amount > 0
  )
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
  const [swapPreviewLoading, setSwapPreviewLoading] = React.useState(false)

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
    formatAtomicAmount,
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
    try {
      const items: Array<{
        token: string
        amount: number
        steps: Array<{ from: string; target: string; provider: string }>
        estimatedOut?: string
        note?: string
      }> = []

      for (const reward of rewards) {
        if (!reward.coinType) {
          items.push({
            token: reward.token,
            amount: reward.amount,
            steps: [],
            note: "Missing coin type",
          })
          continue
        }
        if (reward.coinType === swapTargetCoinType) {
          items.push({
            token: reward.token,
            amount: reward.amount,
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
        const estimatedOut =
          swapTargetDecimals !== null && routerResult?.amountOut
            ? formatAtomicAmount(routerResult.amountOut, swapTargetDecimals)
            : undefined
        items.push({
          token: reward.token,
          amount: reward.amount,
          steps,
          estimatedOut,
        })
      }

      return {
        items,
        targetSymbol: swapTargetSymbol,
      }
    } finally {
      setSwapPreviewLoading(false)
    }
  }, [
    aggregatorClient,
    coinDecimalsMap,
    formatAtomicAmount,
    swapEnabled,
    swapTargetCoinType,
    swapTargetDecimals,
    swapTargetSymbol,
  ])

  const swapAvailable = Boolean(aggregatorClient && swapTargetDecimals !== null)

  const toAtomicAmount = React.useCallback(
    (amount: number, coinType: string) => {
      const decimals = coinDecimalsMap[coinType]
      if (decimals === undefined) return null
      return new BN(
        new BigNumber(amount)
          .shiftedBy(decimals)
          .integerValue(BigNumber.ROUND_FLOOR)
          .toString(10)
      )
    },
    [coinDecimalsMap]
  )

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
        (input) => input.coinType !== swapTargetCoinType
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

  const buildRewardAmountMap = React.useCallback(
    (rewards: RewardSummaryItem["rewards"]) => {
      const map = new Map<string, number>()
      rewards.forEach((reward) => {
        if (!reward.coinType) return
        map.set(
          reward.coinType,
          (map.get(reward.coinType) ?? 0) + reward.amount
        )
      })
      return map
    },
    []
  )

  const appendSuilendClaim = React.useCallback(
    async (tx: Transaction) => {
      if (!account?.address) return { inputs: [], hasClaim: false }
      if (!hasSuilendClaim) return { inputs: [], hasClaim: false }
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
      const { mergedCoinsMap } = suilendClient.claimRewards(
        account.address,
        obligationOwnerCapId,
        suilendClaimRewards,
        tx
      )
      const amountMap = buildRewardAmountMap(getRewardsForProtocol("Suilend"))
      const inputs = Object.entries(mergedCoinsMap)
        .filter(([, coin]) => Boolean(coin))
        .map(([coinType, coin]) => ({
          coinType,
          coin,
          amountAtomic: toAtomicAmount(amountMap.get(coinType) ?? 0, coinType),
        }))
      return { inputs, hasClaim: true }
    },
    [
      account?.address,
      buildRewardAmountMap,
      getRewardsForProtocol,
      hasSuilendClaim,
      suilendClaimRewards,
      suiClient,
      toAtomicAmount,
    ]
  )

  const appendNaviClaim = React.useCallback(
    async (tx: Transaction) => {
      if (!account?.address) return { inputs: [], hasClaim: false }
      const rewards = await getUserAvailableLendingRewards(account.address, {
        env: "prod",
      })
      const claimRewards = rewards.filter(
        (reward) => reward.userClaimableReward > 0
      )
      if (!claimRewards.length) return { inputs: [], hasClaim: false }
      const claimed = await claimLendingRewardsPTB(tx, claimRewards, {
        customCoinReceive: { type: "skip" },
      })
      const inputs = claimed
        .map((item, index) => {
          const reward = claimRewards[index]
          if (!reward) return null
          return {
            coinType: reward.rewardCoinType,
            coin: item.coin as TransactionObjectArgument,
            amountAtomic: toAtomicAmount(
              reward.userClaimableReward,
              reward.rewardCoinType
            ),
          }
        })
        .filter(
          (input): input is {
            coinType: string
            coin: TransactionObjectArgument
            amountAtomic: BN | null
          } => Boolean(input)
        )
      return { inputs, hasClaim: true }
    },
    [account?.address, toAtomicAmount]
  )

  const appendScallopClaim = React.useCallback(
    async (tx: Transaction) => {
      if (!account?.address) return { inputs: [], hasClaim: false }
      const builder = new ScallopBuilder({
        walletAddress: account.address,
        client: suiClient,
      })
      await builder.init()
      const txBlock = builder.createTxBlock(tx)
      txBlock.setSender(account.address)
      const inputs: Array<{
        coinType: string
        coin: TransactionObjectArgument
        amountAtomic: BN | null
      }> = []
      const amountMap = buildRewardAmountMap(getRewardsForProtocol("Scallop"))
      const rewardCoinName = builder.utils.getSpoolRewardCoinName()
      const rewardCoinType = builder.utils.parseCoinType(rewardCoinName)
      const spoolNames = Array.from(builder.constants.whitelist.spool)
      for (const spoolName of spoolNames) {
        const rewardCoins = await txBlock.claimQuick(spoolName)
        rewardCoins.forEach((coin: TransactionObjectArgument) => {
          inputs.push({
            coinType: rewardCoinType,
            coin,
            amountAtomic: toAtomicAmount(
              amountMap.get(rewardCoinType) ?? 0,
              rewardCoinType
            ),
          })
        })
      }
      const obligations = await builder.query.getObligationAccounts(account.address)
      Object.values(obligations).forEach((obligation) => {
        if (!obligation) return
        Object.values(obligation.debts).forEach((debt) => {
          debt?.rewards?.forEach((reward) => {
            if (!reward || reward.availableClaimCoin <= 0) return
            const rewardCoinType = builder.utils.parseCoinType(reward.coinName)
            inputs.push({
              coinType: rewardCoinType,
              coin: txBlock.claimBorrowIncentiveQuick(
                reward.coinName,
                obligation.obligationId
              ) as TransactionObjectArgument,
              amountAtomic: toAtomicAmount(
                amountMap.get(rewardCoinType) ?? 0,
                rewardCoinType
              ),
            })
          })
        })
      })
      return { inputs, hasClaim: inputs.length > 0 }
    },
    [account?.address, buildRewardAmountMap, getRewardsForProtocol, suiClient, toAtomicAmount]
  )

  const appendAlphaLendClaim = React.useCallback(
    async (tx: Transaction) => {
      if (!account?.address) return { inputs: [], hasClaim: false }
      if (!hasAlphaClaim) return { inputs: [], hasClaim: false }
      const positionCapId = await getUserPositionCapId(
        suiClient,
        "mainnet",
        account.address
      )
      if (!positionCapId) {
        throw new Error("Missing AlphaLend position cap.")
      }
      const alphalendClient = new AlphalendClient("mainnet", suiClient)
      const constants = alphalendClient.constants
      const rewardInput = await getAlphaLendRewardInput(
        suiClient,
        constants,
        account.address
      )
      const coinMap = new Map<string, TransactionObjectArgument[]>()
      const fulfillPromise = (
        promise: TransactionObjectArgument,
        coinType: string
      ) => {
        if (
          coinType === constants.SUI_COIN_TYPE
          || coinType === constants.SUI_COIN_TYPE_LONG
        ) {
          return tx.moveCall({
            target: `${constants.ALPHALEND_LATEST_PACKAGE_ID}::alpha_lending::fulfill_promise_SUI`,
            arguments: [
              tx.object(constants.LENDING_PROTOCOL_ID),
              promise,
              tx.object(constants.SUI_SYSTEM_STATE_ID),
              tx.object(constants.SUI_CLOCK_OBJECT_ID),
            ],
          })
        }
        return tx.moveCall({
          target: `${constants.ALPHALEND_LATEST_PACKAGE_ID}::alpha_lending::fulfill_promise`,
          typeArguments: [coinType],
          arguments: [
            tx.object(constants.LENDING_PROTOCOL_ID),
            promise,
            tx.object(constants.SUI_CLOCK_OBJECT_ID),
          ],
        })
      }
      for (const data of rewardInput) {
        for (let coinType of data.coinTypes) {
          coinType = `0x${coinType}`
          const [coin1, promise] = tx.moveCall({
            target: `${constants.ALPHALEND_LATEST_PACKAGE_ID}::alpha_lending::collect_reward`,
            typeArguments: [coinType],
            arguments: [
              tx.object(constants.LENDING_PROTOCOL_ID),
              tx.pure.u64(data.marketId),
              tx.object(positionCapId),
              tx.object(constants.SUI_CLOCK_OBJECT_ID),
            ],
          })
          const collected: TransactionObjectArgument[] = []
          if (coin1) collected.push(coin1)
          if (promise) {
            const coin2 = fulfillPromise(promise, coinType)
            if (coin2) collected.push(coin2)
          }
          if (collected.length) {
            const existing = coinMap.get(coinType) ?? []
            coinMap.set(coinType, existing.concat(collected))
          }
        }
      }
      const amountMap = buildRewardAmountMap(getRewardsForProtocol("AlphaLend"))
      const inputs: Array<{
        coinType: string
        coin: TransactionObjectArgument
        amountAtomic: BN | null
      }> = []
      for (const [coinType, coins] of coinMap.entries()) {
        if (!coins.length) continue
        const merged = coins[0]
        if (coins.length > 1) {
          tx.mergeCoins(merged, coins.slice(1))
        }
        inputs.push({
          coinType,
          coin: merged,
          amountAtomic: toAtomicAmount(amountMap.get(coinType) ?? 0, coinType),
        })
      }
      return { inputs, hasClaim: inputs.length > 0 }
    },
    [
      account?.address,
      buildRewardAmountMap,
      getRewardsForProtocol,
      hasAlphaClaim,
      suiClient,
      toAtomicAmount,
    ]
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
      if (!hasClaim) return null
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
      appendAlphaLendClaim,
      appendNaviClaim,
      appendScallopClaim,
      appendSuilendClaim,
      buildSwapFromInputs,
      swapAvailable,
      swapEnabled,
      transferClaimedCoins,
    ]
  )

  const buildClaimAllTransaction = React.useCallback(async () => {
    const tx = new Transaction()
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
    if (!hasClaim) return null
    if (swapEnabled) {
      if (!swapAvailable) {
        throw new Error("Swap not available.")
      }
      await buildSwapFromInputs(tx, inputs)
      return tx
    }
    transferClaimedCoins(tx, inputs)
    return tx
  }, [
    appendAlphaLendClaim,
    appendNaviClaim,
    appendScallopClaim,
    appendSuilendClaim,
    buildSwapFromInputs,
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
