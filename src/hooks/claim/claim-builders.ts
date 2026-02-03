import type { SuiClient } from "@mysten/sui/client"
import type { TransactionObjectArgument } from "@mysten/sui/transactions"
import { Transaction } from "@mysten/sui/transactions"
import BN from "bn.js"
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
import { getAlphaLendRewardInput } from "@/hooks/claim/alphalend-helpers"
import { buildRewardAmountMap } from "@/hooks/claim/swap-helpers"

export type ClaimInput = {
  coinType: string
  coin: TransactionObjectArgument
  amountAtomic: BN | null
}

export type ClaimResult = {
  inputs: ClaimInput[]
  hasClaim: boolean
}

type ClaimBuilderDeps = {
  accountAddress?: string
  suiClient: SuiClient
  getRewardsForProtocol: (protocol: Protocol) => RewardSummaryItem["rewards"]
  hasSuilendClaim: boolean
  hasAlphaClaim: boolean
  suilendClaimRewards: NonNullable<
    NonNullable<RewardSummaryItem["claimMeta"]>["suilend"]
  >["rewards"]
  toAtomicAmount: (amount: number, coinType: string) => BN | null
}

export function createClaimBuilders({
  accountAddress,
  suiClient,
  getRewardsForProtocol,
  hasSuilendClaim,
  hasAlphaClaim,
  suilendClaimRewards,
  toAtomicAmount,
}: ClaimBuilderDeps) {
  const appendSuilendClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    if (!hasSuilendClaim) return { inputs: [], hasClaim: false }
    const suilendClient = await SuilendClient.initialize(
      LENDING_MARKET_ID,
      LENDING_MARKET_TYPE,
      suiClient
    )
    const ownerCaps = await suiClient.getOwnedObjects({
      owner: accountAddress,
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
      accountAddress,
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
  }

  const appendNaviClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    const rewards = await getUserAvailableLendingRewards(accountAddress, {
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
        (input): input is ClaimInput => Boolean(input)
      )
    return { inputs, hasClaim: true }
  }

  const appendScallopClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    const builder = new ScallopBuilder({
      walletAddress: accountAddress,
      client: suiClient,
    })
    await builder.init()
    const txBlock = builder.createTxBlock(tx)
    txBlock.setSender(accountAddress)
    const inputs: ClaimInput[] = []
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
    const obligations = await builder.query.getObligationAccounts(accountAddress)
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
  }

  const appendAlphaLendClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    if (!hasAlphaClaim) return { inputs: [], hasClaim: false }
    const positionCapId = await getUserPositionCapId(
      suiClient,
      "mainnet",
      accountAddress
    )
    if (!positionCapId) {
      throw new Error("Missing AlphaLend position cap.")
    }
    const alphalendClient = new AlphalendClient("mainnet", suiClient)
    const constants = alphalendClient.constants
    const rewardInput = await getAlphaLendRewardInput(
      suiClient,
      constants,
      accountAddress
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
    const inputs: ClaimInput[] = []
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
  }

  return {
    appendSuilendClaim,
    appendNaviClaim,
    appendScallopClaim,
    appendAlphaLendClaim,
  }
}
