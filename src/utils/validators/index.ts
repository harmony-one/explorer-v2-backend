import {
  isHexString,
  isLength,
  isUint,
  isShardAvailable,
  CurryParamValidator,
  ParamValidator,
  isOneOf as isOneOfValidator,
} from './validators'
import {Filter, FilterEntry, FilterOrderBy} from 'src/types'

export const isShard: CurryParamValidator = (value: number) => () => [
  isUint(value, {min: 0, max: 3}),
  isShardAvailable(value),
]
export const isBlockNumber: CurryParamValidator = (value: number) => () => isUint(value, {min: 0})

export const is64CharHexHash: CurryParamValidator = (value: string) => () => [
  isHexString(value),
  isLength(value, {min: 66, max: 66}),
]

export const is64CharHexSignature: CurryParamValidator = (value: string) => () => [
  isHexString(value),
  isLength(value, {min: 10, max: 66}),
]

export const isTransactionHash: CurryParamValidator = (value: string) => () => [
  isHexString(value),
  isLength(value, {min: 66, max: 66}),
]

export const isAddress: CurryParamValidator = (value: string) => () => [
  isHexString(value),
  isLength(value, {min: 42, max: 42}),
]

export const isOffset: CurryParamValidator = (value: number) => () => isUint(value, {min: 0})
export const isLimit: CurryParamValidator = (value: number, max = 100) => () =>
  isUint(value, {min: 0, max})

export const isOneOf: CurryParamValidator = (value: number, params: String[]) => () =>
  isOneOfValidator(value, params)

export const isOrderDirection: CurryParamValidator = (value: number) => () =>
  isOneOfValidator(value, ['asc', 'desc'])

export const isOrderBy: CurryParamValidator = (
  value: number,
  allowedFields: FilterOrderBy[]
) => () => isOneOfValidator(value, allowedFields)

// todo check FilterEntry value
export const isFilters: CurryParamValidator = (
  value: FilterEntry[],
  allowedFields: FilterOrderBy[]
) => () => {
  return value
    .map((f) => [
      isOneOfValidator(f.property, allowedFields),
      isOneOfValidator(f.type, ['gt', 'gte', 'lt', 'lte', 'eq']),
    ])
    .flatMap((f) => f)
}

export const Void: ParamValidator = () => {}
