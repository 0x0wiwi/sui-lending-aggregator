import { bcs } from "@mysten/sui/bcs"
import { Transaction } from "@mysten/sui/transactions"
import { deriveDynamicFieldID } from "@mysten/sui/utils"
import BigNumber from "bignumber.js"

import { isCurrentMarketVisible } from "@/lib/current-market-visibility"
import { calculateCurrentClaimable } from "@/lib/current-reward-math"
import {
  createPositionKey,
  type WalletPositions,
} from "@/lib/positions"
import {
  normalizeCoinType,
  type IncentiveBreakdown,
  type RewardSummaryItem,
} from "@/lib/market-data"
import { mainnetSuiClient } from "@/lib/sui-client"
import {
  formatTokenSymbol,
  sumBreakdown,
  toAssetSymbolFromSource,
} from "./utils"
import type {
  MarketFetchResult,
  MarketOnlyResult,
  UserOnlyResult,
} from "./types"

const CURRENT_API = "https://api.current.finance"
const CURRENT_PACKAGE =
  "0x45bae0425e9098ce5cba3d3fa2836220ad24c9f88aa0dffffb5a52b49319fc70"
const CURRENT_MARKET = "MainMarket"
const WAD = 1_000_000_000_000_000_000n

type ApiResponse<T> = {
  code: number
  data: T
  message: string
}

type CurrentMarketRow = {
  apy?: number
  borrowAPY?: number
  hidden?: boolean
  labelGroup?: unknown
  marketID: string
  marketType: string
  name: string
  borrowPaused?: boolean
  supplyPaused?: boolean
  supplyAPY?: number
  token: string
  tokenInfo?: { symbol?: string }
  utilization?: number
}

type CurrentMarketPage = {
  content: CurrentMarketRow[]
}

type CurrentRewardSchedule = {
  apr?: number
  endTimeMs?: number
  rewardCoinType: string
  startTimeMs?: number
}

type CurrentRewardSummary = {
  reserveCoinType: string
  rewardType: number
  rewards?: CurrentRewardSchedule[]
}

type CurrentMarketConfig = {
  marketID: string
  marketType: string
  name: string
  summaries?: CurrentRewardSummary[]
}

type CurrentObligation = {
  marketType: string
  obligationObject: string
  ownerCap: string
}

type Table = { id?: string }
type CurrentObligationJson = {
  ctokens?: {
    ctoken_values?: Table
  }
  debts?: {
    keys?: { contents?: string[] }
  }
  lending_market_id?: string
}

type CurrentMarketJson = {
  liquidity_miner?: {
    borrow?: Table
    deposit?: Table
  }
}

type FieldJson<T> = {
  name?: string
  value?: T
}

type PoolRewardManager = {
  last_update_time_ms?: string
  obligation_reward_managers?: Table
  pool_rewards?: Array<{
    coin_type?: string
    cumulative_rewards_per_share?: { value?: string }
    end_time_ms?: string
    start_time_ms?: string
    total_rewards?: string
  } | null>
  total_shares?: string
}

type ObligationRewardManager = {
  last_update_time_ms?: string
  rewards?: Array<{
    cumulative_rewards_per_share?: { value?: string }
    earned_rewards?: { value?: string }
  } | null>
  share?: string
}

type CurrentClaim = NonNullable<
  NonNullable<RewardSummaryItem["claimMeta"]>["current"]
>["claims"][number]

let currentMarketPageRequest: Promise<CurrentMarketPage> | null = null

async function fetchCurrentApi<T>(path: string) {
  const response = await fetch(`${CURRENT_API}${path}`)
  if (!response.ok) {
    throw new Error(`Current API failed: ${response.status}`)
  }
  const payload = await response.json() as ApiResponse<T>
  if (payload.code !== 0) {
    throw new Error(payload.message || "Current API failed.")
  }
  return payload.data
}

async function fetchCurrentMainMarketPage() {
  if (currentMarketPageRequest) return currentMarketPageRequest
  currentMarketPageRequest = fetchCurrentApi<CurrentMarketPage>(
    `/market/getMarketList?marketType=${CURRENT_MARKET}&page=1&size=100`
  )
  try {
    return await currentMarketPageRequest
  } finally {
    currentMarketPageRequest = null
  }
}

function normalizeCurrentType(value: string) {
  return normalizeCoinType(value.startsWith("0x") ? value : `0x${value}`)
    ?? value
}

function toTypeName(value: string) {
  const normalized = normalizeCurrentType(value)
  return normalized.startsWith("0x") ? normalized.slice(2) : normalized
}

function getVisibleCurrentAssets(page: CurrentMarketPage) {
  return new Map(
    page.content.flatMap((market) => {
      const symbol = market.tokenInfo?.symbol?.trim()
      if (!isCurrentMarketVisible(market) || !symbol) return []
      return [[normalizeCurrentType(market.token), symbol] as const]
    })
  )
}

function getActiveBreakdown(
  summaries: CurrentRewardSummary[],
  reserveCoinType: string,
  rewardType: number
): IncentiveBreakdown[] {
  const now = Date.now()
  const normalizedReserve = normalizeCurrentType(reserveCoinType)
  const totals = new Map<string, number>()
  summaries
    .filter(
      (summary) =>
        summary.rewardType === rewardType
        && normalizeCurrentType(summary.reserveCoinType) === normalizedReserve
    )
    .flatMap((summary) => summary.rewards ?? [])
    .filter(
      (reward) =>
        (!reward.startTimeMs || now >= reward.startTimeMs)
        && (!reward.endTimeMs || now <= reward.endTimeMs)
        && Number(reward.apr) > 0
    )
    .forEach((reward) => {
      const token = formatTokenSymbol(reward.rewardCoinType)
      totals.set(token, (totals.get(token) ?? 0) + Number(reward.apr) * 100)
    })
  return Array.from(totals, ([token, apr]) => ({ token, apr }))
}

async function getObjectJson<T>(objectId: string) {
  const { object } = await mainnetSuiClient.getObject({
    objectId,
    include: { json: true },
  })
  if (!object.json) throw new Error(`Missing Current object: ${objectId}`)
  return object.json as T
}

async function getObjectJsonOrNull<T>(objectId: string) {
  const { objects } = await mainnetSuiClient.getObjects({
    objectIds: [objectId],
    include: { json: true },
  })
  const object = objects[0]
  return object instanceof Error || !object?.json ? null : object.json as T
}

async function getDynamicFieldValue<T>(
  parentId: string,
  keyType: string,
  keyBcs: Uint8Array
) {
  const fieldId = deriveDynamicFieldID(parentId, keyType, keyBcs)
  return getObjectJsonOrNull<FieldJson<T>>(fieldId).then(
    (field) => field?.value ?? null
  )
}

async function getMarketRates(
  marketId: string,
  marketType: string,
  coinTypes: string[]
) {
  if (!coinTypes.length) return new Map<string, bigint>()
  const tx = new Transaction()
  coinTypes.forEach((coinType) => {
    tx.moveCall({
      target: `${CURRENT_PACKAGE}::market_query::get_asset_market_rates`,
      arguments: [
        tx.object(marketId),
        tx.pure.string(toTypeName(coinType)),
        tx.object("0x6"),
      ],
      typeArguments: [normalizeCurrentType(marketType)],
    })
  })
  tx.setSender("0x0")
  const result = await mainnetSuiClient.simulateTransaction({
    transaction: tx,
    include: { commandResults: true },
    checksEnabled: false,
  })
  if (result.$kind !== "Transaction" || !result.commandResults) {
    throw new Error("Current rate query failed.")
  }
  const decimals = bcs.vector(
    bcs.struct("Decimal", { value: bcs.u256() })
  )
  return new Map(
    result.commandResults.map((command, index) => {
      const values = decimals.parse(
        Uint8Array.from(command.returnValues[0].bcs)
      )
      return [normalizeCurrentType(coinTypes[index]), BigInt(values[0].value)]
    })
  )
}

async function getClaimableForPool(
  tableId: string | undefined,
  obligationId: string,
  reserveCoinType: string,
  rewardType: number,
  claimBase: Omit<CurrentClaim, "amountAtomic" | "rewardCoinType" | "rewardIndex" | "rewardType">
) {
  if (!tableId) return []
  const pool = await getDynamicFieldValue<PoolRewardManager>(
    tableId,
    "0x1::type_name::TypeName",
    bcs.struct("TypeName", { name: bcs.string() }).serialize({
      name: toTypeName(reserveCoinType),
    }).toBytes()
  )
  const rewardManagerId = pool?.obligation_reward_managers?.id
  if (!pool || !rewardManagerId) return []
  const obligation = await getDynamicFieldValue<ObligationRewardManager>(
    rewardManagerId,
    "0x2::object::ID",
    bcs.Address.serialize(obligationId).toBytes()
  )
  if (!obligation) return []

  return (pool.pool_rewards ?? []).flatMap<CurrentClaim>((reward, index) => {
    if (!reward?.coin_type) return []
    const amount = calculateCurrentClaimable(
      reward,
      obligation.rewards?.[index] ?? null,
      BigInt(obligation.share ?? 0),
      BigInt(pool.total_shares ?? 0),
      BigInt(pool.last_update_time_ms ?? 0),
      BigInt(obligation.last_update_time_ms ?? 0),
      BigInt(Date.now())
    )
    if (amount <= 0n) return []
    return [{
      ...claimBase,
      amountAtomic: amount.toString(),
      rewardCoinType: normalizeCurrentType(reward.coin_type),
      rewardIndex: index,
      rewardType,
    }]
  })
}

async function fetchObligation(
  obligation: CurrentObligation,
  visibleAssets?: Map<string, string>
) {
  const obligationJson = await getObjectJson<CurrentObligationJson>(
    obligation.obligationObject
  )
  const marketId = obligationJson.lending_market_id
  const ctokenTableId = obligationJson.ctokens?.ctoken_values?.id
  if (!marketId || !ctokenTableId) {
    throw new Error("Invalid Current obligation.")
  }
  const marketJson = await getObjectJson<CurrentMarketJson>(marketId)
  const { dynamicFields } = await mainnetSuiClient.listDynamicFields({
    parentId: ctokenTableId,
  })
  const ctokenObjects = await mainnetSuiClient.getObjects({
    objectIds: dynamicFields.map((field) => field.fieldId),
    include: { json: true },
  })
  const deposits = ctokenObjects.objects.flatMap((object) => {
    if (object instanceof Error || !object.json) return []
    const field = object.json as FieldJson<string>
    const match = field.name?.match(/,(.+)>$/)
    if (!match || field.value === undefined) return []
    return [{
      coinType: normalizeCurrentType(match[1]),
      ctokenAmount: BigInt(field.value),
    }]
  })
  const depositTypes = deposits.map((deposit) => deposit.coinType)
  const debtTypes = obligationJson.debts?.keys?.contents?.map(normalizeCurrentType)
    ?? []
  const allCoinTypes = Array.from(new Set([...depositTypes, ...debtTypes]))
  const marketName = obligation.marketType.split("::").pop() ?? "Market"
  const displayedDeposits = marketName === CURRENT_MARKET && visibleAssets
    ? deposits.filter((deposit) => visibleAssets.has(deposit.coinType))
    : []
  const rates = await getMarketRates(
    marketId,
    obligation.marketType,
    displayedDeposits.map((deposit) => deposit.coinType)
  )
  const metadataEntries = await Promise.all(
    displayedDeposits.map(async ({ coinType }) => {
      const { coinMetadata } = await mainnetSuiClient.getCoinMetadata({ coinType })
      return [coinType, coinMetadata] as const
    })
  )
  const metadata = new Map(metadataEntries)
  const positions = displayedDeposits.flatMap((deposit) => {
    const coinMetadata = metadata.get(deposit.coinType)
    const exchangeRate = rates.get(deposit.coinType)
    const symbol = visibleAssets?.get(deposit.coinType)
    if (!coinMetadata || exchangeRate === undefined || !symbol) return []
    const amountAtomic = deposit.ctokenAmount * exchangeRate / WAD
    return [{
      asset: symbol,
      amount: new BigNumber(amountAtomic.toString())
        .shiftedBy(-coinMetadata.decimals)
        .toNumber(),
    }]
  })

  const claimBase = {
    marketObjectId: marketId,
    marketType: normalizeCurrentType(obligation.marketType),
    obligationOwnerCapId: obligation.ownerCap,
  }
  const claims = (await Promise.all(
    allCoinTypes.flatMap((coinType) => [
      getClaimableForPool(
        marketJson.liquidity_miner?.deposit?.id,
        obligation.obligationObject,
        coinType,
        0,
        { ...claimBase, reserveCoinType: coinType }
      ),
      getClaimableForPool(
        marketJson.liquidity_miner?.borrow?.id,
        obligation.obligationObject,
        coinType,
        1,
        { ...claimBase, reserveCoinType: coinType }
      ),
    ])
  )).flat()
  return { claims, positions }
}

export async function fetchCurrentMarket(): Promise<MarketOnlyResult> {
  const [configs, page] = await Promise.all([
    fetchCurrentApi<CurrentMarketConfig[]>(
      "/pebbleWeb3Config/getAllMarketConfig"
    ),
    fetchCurrentMainMarketPage(),
  ])
  const configByName = new Map(configs.map((config) => [config.name, config]))
  return {
    rows: page.content.flatMap((market) => {
      if (!isCurrentMarketVisible(market)) return []
      const config = configByName.get(market.name)
      const coinType = normalizeCurrentType(market.token)
      const symbol = market.tokenInfo?.symbol?.trim()
        || toAssetSymbolFromSource(null, coinType)
      if (!config || !symbol) return []
      const supplyBreakdown = getActiveBreakdown(
        config.summaries ?? [], coinType, 0
      )
      const borrowBreakdown = getActiveBreakdown(
        config.summaries ?? [], coinType, 1
      )
      const supplyBaseApr = market.supplyPaused
        ? Number.NaN
        : Number(market.apy) + Number(market.supplyAPY) * 100
      const borrowBaseApr = market.borrowPaused
        ? Number.NaN
        : Number(market.borrowAPY) * 100
      const supplyIncentiveApr = market.supplyPaused
        ? 0
        : sumBreakdown(supplyBreakdown)
      const borrowIncentiveApr = market.borrowPaused
        ? 0
        : sumBreakdown(borrowBreakdown)
      return [{
        asset: symbol,
        coinType,
        protocol: "Current" as const,
        supplyApr: supplyBaseApr + supplyIncentiveApr,
        borrowApr: Math.max(0, borrowBaseApr - borrowIncentiveApr),
        utilization: Number(market.utilization) * 100,
        supplyBaseApr,
        borrowBaseApr,
        supplyIncentiveApr,
        borrowIncentiveApr,
        supplyIncentiveBreakdown: supplyBreakdown,
        borrowIncentiveBreakdown: borrowBreakdown,
      }]
    }),
  }
}

export async function fetchCurrentUser(
  address?: string | null
): Promise<UserOnlyResult> {
  if (!address) return { positions: {} }
  const [obligations, page] = await Promise.all([
    fetchCurrentApi<CurrentObligation[]>(
      `/user/getObligationList/${address}`
    ),
    fetchCurrentMainMarketPage(),
  ])
  const visibleAssets = getVisibleCurrentAssets(page)
  const results = await Promise.all(
    obligations.map((obligation) => fetchObligation(obligation, visibleAssets))
  )
  const positions = results.reduce<WalletPositions>((acc, result) => {
    result.positions.forEach((position) => {
      const key = createPositionKey("Current", position.asset)
      acc[key] = (acc[key] ?? 0) + position.amount
    })
    return acc
  }, {})
  const claims = results.flatMap((result) => result.claims)
  const rewardAmounts = new Map<string, bigint>()
  claims.forEach((claim) => {
    rewardAmounts.set(
      claim.rewardCoinType,
      (rewardAmounts.get(claim.rewardCoinType) ?? 0n)
        + BigInt(claim.amountAtomic)
    )
  })
  const rewardMetadata = new Map(
    (await Promise.all(
      Array.from(rewardAmounts.keys()).map(async (coinType) => {
        const { coinMetadata } = await mainnetSuiClient.getCoinMetadata({ coinType })
        return [coinType, coinMetadata] as const
      })
    ))
  )
  const rewardSummary: RewardSummaryItem = {
    protocol: "Current",
    supplies: Object.entries(positions).map(([key, amount]) => ({
      asset: key.slice("Current-".length),
      amount: amount ?? 0,
    })),
    rewards: Array.from(rewardAmounts, ([coinType, amount]) => {
      const metadata = rewardMetadata.get(coinType)
      if (!metadata) throw new Error(`Missing coin metadata: ${coinType}`)
      return {
        token: metadata.symbol,
        amount: new BigNumber(amount.toString())
          .shiftedBy(-metadata.decimals)
          .toNumber(),
        coinType,
      }
    }),
    claimMeta: { current: { claims } },
  }
  return { positions, rewardSummary }
}

export async function fetchCurrentClaims(address: string) {
  const obligations = await fetchCurrentApi<CurrentObligation[]>(
    `/user/getObligationList/${address}`
  )
  const results = await Promise.all(obligations.map((obligation) =>
    fetchObligation(obligation)
  ))
  return results.flatMap((result) => result.claims)
}

export async function fetchCurrent(
  address?: string | null
): Promise<MarketFetchResult> {
  const [market, user] = await Promise.all([
    fetchCurrentMarket(),
    fetchCurrentUser(address),
  ])
  return { rows: market.rows, ...user }
}
