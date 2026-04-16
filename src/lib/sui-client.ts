import { bcs } from "@mysten/sui/bcs"
import { SuiGrpcClient } from "@mysten/sui/grpc"
import { normalizeStructTag, toBase64 } from "@mysten/sui/utils"

const MAINNET_GRPC_URL = "https://fullnode.mainnet.sui.io:443"

type LegacyObjectOptions = {
  showBcs?: boolean
  showContent?: boolean
  showDisplay?: boolean
  showOwner?: boolean
  showPreviousTransaction?: boolean
  showType?: boolean
}

type LegacyDynamicFieldName = {
  type: string
  value?: unknown
  bcs?: Uint8Array
}

type LegacyObjectData = {
  bcs?: {
    bcsBytes: string
    dataType: "moveObject" | "package"
    hasPublicTransfer: boolean
    type?: string | null
  } | null
  content?: {
    dataType: "moveObject" | "package"
    fields: unknown
    type?: string | null
  } | null
  digest: string
  display?: unknown
  objectId: string
  owner?: unknown
  previousTransaction?: string | null
  type?: string | null
  version: string
}

type LegacyObjectResponse = {
  data: LegacyObjectData | null
  error?: {
    message: string
  }
}

type CoreObject = Awaited<ReturnType<SuiGrpcClient["getObject"]>>["object"]

function createMainnetGrpcClient() {
  return new SuiGrpcClient({
    network: "mainnet",
    baseUrl: MAINNET_GRPC_URL,
  })
}

function toLegacyContent(
  object: CoreObject
): LegacyObjectData["content"] {
  if (object.type === "package") {
    return {
      dataType: "package",
      fields: null,
      type: object.type,
    }
  }
  return {
    dataType: "moveObject",
    fields: wrapLegacyIds(object.json ?? {}),
    type: object.type,
  }
}

function toLegacyBcs(
  object: CoreObject
): LegacyObjectData["bcs"] {
  return {
    bcsBytes: toBase64(object.content ?? new Uint8Array()),
    dataType: object.type === "package" ? "package" : "moveObject",
    hasPublicTransfer: true,
    type: object.type,
  }
}

function wrapLegacyIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => wrapLegacyIds(item))
  }
  if (!value || typeof value !== "object") {
    return value
  }
  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((acc, [key, entryValue]) => {
    if (key === "id" && typeof entryValue === "string") {
      acc[key] = { id: entryValue }
      return acc
    }
    acc[key] = wrapLegacyIds(entryValue)
    return acc
  }, {})
}

function toLegacyObjectData(
  object: CoreObject,
  options?: LegacyObjectOptions | null
): LegacyObjectData {
  const showContent = Boolean(options?.showContent)
  const showBcs = Boolean(options?.showBcs)
  const showDisplay = Boolean(options?.showDisplay)
  const showOwner = Boolean(options?.showOwner)
  const showPreviousTransaction = Boolean(options?.showPreviousTransaction)
  const showType =
    Boolean(options?.showType)
    || showContent
    || showBcs

  return {
    bcs: showBcs ? toLegacyBcs(object) : undefined,
    content: showContent ? toLegacyContent(object) : undefined,
    digest: object.digest,
    display: showDisplay ? object.display ?? null : undefined,
    objectId: object.objectId,
    owner: showOwner ? object.owner : undefined,
    previousTransaction: showPreviousTransaction
      ? object.previousTransaction ?? null
      : undefined,
    type: showType ? object.type : undefined,
    version: object.version,
  }
}

function toCoreObjectInclude(options?: LegacyObjectOptions | null) {
  return {
    content: Boolean(options?.showBcs),
    display: Boolean(options?.showDisplay),
    json: Boolean(options?.showContent),
    previousTransaction: Boolean(options?.showPreviousTransaction),
  }
}

function extractCoinType(type: string) {
  const match = type.match(/^0x2::coin::Coin<(.*)>$/)
  return match?.[1] ?? type
}

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0
  chunks.forEach((chunk) => {
    combined.set(chunk, offset)
    offset += chunk.length
  })
  return combined
}

function encodeSimpleBcsValue(value: unknown): Uint8Array {
  if (typeof value === "boolean") {
    return bcs.bool().serialize(value).toBytes()
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return bcs.u64().serialize(value).toBytes()
  }
  if (typeof value === "string") {
    return value.startsWith("0x")
      ? bcs.Address.serialize(value).toBytes()
      : bcs.string().serialize(value).toBytes()
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return concatBytes(
      Object.values(value as Record<string, unknown>).map((fieldValue) =>
        encodeSimpleBcsValue(fieldValue)
      )
    )
  }
  throw new Error("Unsupported dynamic field name value.")
}

function encodeDynamicFieldName(name: LegacyDynamicFieldName) {
  if (name.bcs instanceof Uint8Array) {
    return {
      bcs: name.bcs,
      type: name.type,
    }
  }

  const { type, value } = name
  if (value === undefined) {
    throw new Error(`Missing dynamic field name value for ${type}.`)
  }

  if (
    type === "0x2::object::ID"
    || type === "address"
    || type.includes("::typed_id::TypedID")
  ) {
    return {
      bcs: bcs.Address.serialize(value as string).toBytes(),
      type,
    }
  }

  if (type === "bool") {
    return {
      bcs: bcs.bool().serialize(value as boolean).toBytes(),
      type,
    }
  }

  if (type === "u8") {
    return {
      bcs: bcs.u8().serialize(value as number).toBytes(),
      type,
    }
  }

  if (type === "u64") {
    return {
      bcs: bcs.u64().serialize(value as number | bigint).toBytes(),
      type,
    }
  }

  if (type === "u128") {
    return {
      bcs: bcs.u128().serialize(value as string | number | bigint).toBytes(),
      type,
    }
  }

  if (type === "u256") {
    return {
      bcs: bcs.u256().serialize(value as string | number | bigint).toBytes(),
      type,
    }
  }

  if (type.includes("::type_name::TypeName")) {
    const nameValue =
      typeof value === "object" && value !== null && "name" in value
        ? String((value as { name: unknown }).name)
        : normalizeStructTag(String(value))
    return {
      bcs: bcs
        .struct("TypeName", { name: bcs.string() })
        .serialize({ name: nameValue })
        .toBytes(),
      type,
    }
  }

  if (value && typeof value === "object") {
    return {
      bcs: encodeSimpleBcsValue(value),
      type,
    }
  }

  return {
    bcs: encodeSimpleBcsValue(value),
    type,
  }
}

export class SuiLegacyClientAdapter {
  readonly core
  readonly inner
  readonly mvr
  readonly network

  constructor(client: SuiGrpcClient) {
    this.core = client.core
    this.inner = client
    this.mvr = client.mvr
    this.network = client.network
  }

  async getObject({
    id,
    options,
  }: {
    id: string
    options?: LegacyObjectOptions | null
  }): Promise<LegacyObjectResponse> {
    const { object } = await this.inner.getObject({
      objectId: id,
      include: toCoreObjectInclude(options),
    })
    return {
      data: toLegacyObjectData(object, options),
    }
  }

  async multiGetObjects({
    ids,
    options,
  }: {
    ids: string[]
    options?: LegacyObjectOptions | null
  }) {
    const { objects } = await this.inner.getObjects({
      objectIds: ids,
      include: toCoreObjectInclude(options),
    })
    return objects.map((object) =>
      object instanceof Error
        ? {
            data: null,
            error: { message: object.message },
          }
        : {
            data: toLegacyObjectData(object, options),
          }
    )
  }

  async getOwnedObjects({
    owner,
    filter,
    options,
    cursor,
    limit,
  }: {
    owner: string
    filter?: { StructType?: string } | null
    options?: LegacyObjectOptions | null
    cursor?: string | null
    limit?: number | null
  }) {
    const response = await this.inner.listOwnedObjects({
      owner,
      type: filter?.StructType,
      include: toCoreObjectInclude(options),
      cursor: cursor ?? undefined,
      limit: limit ?? undefined,
    })

    return {
      data: response.objects.map((object) => ({
        data: toLegacyObjectData(object, options),
      })),
      hasNextPage: response.hasNextPage,
      nextCursor: response.cursor,
    }
  }

  async getCoins({
    owner,
    coinType,
    cursor,
    limit,
  }: {
    owner: string
    coinType?: string
    cursor?: string | null
    limit?: number | null
  }) {
    const response = await this.inner.listCoins({
      owner,
      coinType,
      cursor: cursor ?? undefined,
      limit: limit ?? undefined,
    })

    return {
      data: response.objects.map((coin) => ({
        balance: coin.balance,
        coinObjectId: coin.objectId,
        coinType: extractCoinType(coin.type),
        digest: coin.digest,
        version: coin.version,
      })),
      hasNextPage: response.hasNextPage,
      nextCursor: response.cursor,
    }
  }

  async getCoinMetadata({ coinType }: { coinType: string }) {
    const { coinMetadata } = await this.inner.getCoinMetadata({ coinType })
    return coinMetadata
      ? {
          decimals: coinMetadata.decimals,
          description: coinMetadata.description,
          iconUrl: coinMetadata.iconUrl ?? null,
          id: coinMetadata.id ?? null,
          name: coinMetadata.name,
          symbol: coinMetadata.symbol,
        }
      : null
  }

  async getDynamicFields({
    parentId,
    cursor,
    limit,
  }: {
    parentId: string
    cursor?: string | null
    limit?: number | null
  }) {
    const response = await this.inner.listDynamicFields({
      parentId,
      cursor: cursor ?? undefined,
      limit: limit ?? undefined,
    })

    return {
      data: response.dynamicFields.map((field) => ({
        bcsEncoding: "base64" as const,
        bcsName: toBase64(field.name.bcs),
        digest: "",
        name: {
          type: field.name.type,
          value: toBase64(field.name.bcs),
        },
        objectId: field.childId ?? field.fieldId,
        objectType: field.valueType,
        type: field.$kind,
        version: "",
      })),
      hasNextPage: response.hasNextPage,
      nextCursor: response.cursor,
    }
  }

  async getDynamicFieldObject({
    parentId,
    name,
    options,
  }: {
    parentId: string
    name: LegacyDynamicFieldName
    options?: LegacyObjectOptions | null
  }): Promise<LegacyObjectResponse> {
    const encodedName = encodeDynamicFieldName(name)
    const { dynamicField } = await this.inner.getDynamicField({
      parentId,
      name: encodedName,
    })
    const field = dynamicField as {
      $kind: "DynamicField" | "DynamicObject"
      childId?: string | null
      fieldId: string
    }
    const targetObjectId =
      field.$kind === "DynamicObject"
        ? field.childId ?? field.fieldId
        : field.fieldId
    return this.getObject({
      id: targetObjectId,
      options: options ?? {
        showContent: true,
        showType: true,
      },
    })
  }

  async queryTransactionBlocks() {
    throw new Error(
      "queryTransactionBlocks requires GraphQL and is not enabled in the gRPC compatibility client."
    )
  }
}

const legacyClientCache = new WeakMap<SuiGrpcClient, SuiLegacyClientAdapter>()

export function getLegacySuiClient(client: SuiGrpcClient) {
  const cached = legacyClientCache.get(client)
  if (cached) {
    return cached
  }
  const next = new SuiLegacyClientAdapter(client)
  legacyClientCache.set(client, next)
  return next
}

export const mainnetSuiClient = createMainnetGrpcClient()
export const mainnetLegacySuiClient = getLegacySuiClient(mainnetSuiClient)
