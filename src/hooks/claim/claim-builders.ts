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
import type { SuiLegacyClientAdapter } from "@/lib/sui-client"
import { getAlphaLendRewardInput } from "@/hooks/claim/alphalend-helpers"
import { buildRewardAmountMap } from "@/hooks/claim/swap-helpers"

const CURRENT_PACKAGE =
  "0x45bae0425e9098ce5cba3d3fa2836220ad24c9f88aa0dffffb5a52b49319fc70"
const CURRENT_PROTOCOL_APP =
  "0xd4395f77a48f6d64af2008280c8dc06ee0fe69953a141e683935f6086d849177"

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
  suiClient: SuiLegacyClientAdapter
  getRewardsForProtocol: (protocol: Protocol) => RewardSummaryItem["rewards"]
  hasSuilendClaim: boolean
  hasAlphaClaim: boolean
  hasCurrentClaim: boolean
  suilendClaimRewards: NonNullable<
    NonNullable<RewardSummaryItem["claimMeta"]>["suilend"]
  >["rewards"]
  toAtomicAmount: (amount: number, coinType: string) => BN | null
}

type SuilendRpcClient = Parameters<typeof SuilendClient.initialize>[2]

export function createClaimBuilders({
  accountAddress,
  suiClient,
  getRewardsForProtocol,
  hasSuilendClaim,
  hasAlphaClaim,
  hasCurrentClaim,
  suilendClaimRewards,
  toAtomicAmount,
}: ClaimBuilderDeps) {
  const appendSuilendClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    if (!hasSuilendClaim) return { inputs: [], hasClaim: false }
    const suilendClient = await SuilendClient.initialize(
      LENDING_MARKET_ID,
      LENDING_MARKET_TYPE,
      suiClient.inner as unknown as SuilendRpcClient
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

  const appendCurrentClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress || !hasCurrentClaim) {
      return { inputs: [], hasClaim: false }
    }
    const { fetchCurrentUser } = await import("@/lib/market-fetch/current")
    const freshClaims = (await fetchCurrentUser(accountAddress))
      .rewardSummary?.claimMeta?.current?.claims ?? []
    const coinMap = new Map<string, TransactionObjectArgument[]>()
    const amountMap = new Map<string, BN>()
    freshClaims.forEach((claim) => {
      const coin = tx.moveCall({
        target: `${CURRENT_PACKAGE}::liquidity_mining::claim_reward_as_coin`,
        arguments: [
          tx.object(CURRENT_PROTOCOL_APP),
          tx.object(claim.marketObjectId),
          tx.object(claim.obligationOwnerCapId),
          tx.pure.u8(claim.rewardType),
          tx.pure.u64(claim.rewardIndex),
          tx.object("0x6"),
        ],
        typeArguments: [
          claim.marketType,
          claim.reserveCoinType,
          claim.rewardCoinType,
        ],
      })
      coinMap.set(
        claim.rewardCoinType,
        (coinMap.get(claim.rewardCoinType) ?? []).concat(coin)
      )
      amountMap.set(
        claim.rewardCoinType,
        (amountMap.get(claim.rewardCoinType) ?? new BN(0)).add(
          new BN(claim.amountAtomic)
        )
      )
    })
    const inputs = Array.from(coinMap, ([coinType, coins]) => {
      const coin = coins[0]
      if (coins.length > 1) tx.mergeCoins(coin, coins.slice(1))
      return { coinType, coin, amountAtomic: amountMap.get(coinType) ?? null }
    })
    return { inputs, hasClaim: inputs.length > 0 }
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
      suiClients: [suiClient.inner],
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
    for (const obligation of Object.values(obligations)) {
      if (!obligation) continue
      for (const debt of Object.values(obligation.debts)) {
        for (const reward of debt?.rewards ?? []) {
          if (!reward || reward.availableClaimCoin <= 0) continue
          const rewardCoinType = builder.utils.parseCoinType(reward.coinName)
          inputs.push({
            coinType: rewardCoinType,
            coin: await txBlock.claimBorrowIncentiveQuick(
              reward.coinName,
              obligation.obligationId
            ) as unknown as TransactionObjectArgument,
            amountAtomic: toAtomicAmount(
              amountMap.get(rewardCoinType) ?? 0,
              rewardCoinType
            ),
          })
        }
      }
    }
    return { inputs, hasClaim: inputs.length > 0 }
  }

  const appendAlphaLendClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    if (!hasAlphaClaim) return { inputs: [], hasClaim: false }
    const alphalendClient = new AlphalendClient("mainnet")
    const firstPositionCapId = await getUserPositionCapId(
      alphalendClient.blockchain,
      accountAddress
    )
    if (!firstPositionCapId) {
      throw new Error("Missing AlphaLend position cap.")
    }
    const constants = alphalendClient.constants
    const rewardInput = await getAlphaLendRewardInput(
      alphalendClient.blockchain,
      accountAddress
    )
    const coinMap = new Map<string, TransactionObjectArgument[]>()
    const normalizeAlphaLendCoinType = (coinType: string) =>
      coinType.startsWith("0x") ? coinType : `0x${coinType}`
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
      for (const rawCoinType of data.coinTypes) {
        const coinType = normalizeAlphaLendCoinType(rawCoinType)
        const [coin1, promise] = tx.moveCall({
          target: `${constants.ALPHALEND_LATEST_PACKAGE_ID}::alpha_lending::collect_reward`,
          typeArguments: [coinType],
          arguments: [
            tx.object(constants.LENDING_PROTOCOL_ID),
            tx.pure.u64(data.marketId),
            tx.object(data.positionCapId),
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
    appendCurrentClaim,
  }
}
