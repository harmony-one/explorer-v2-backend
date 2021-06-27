// todo add generics
import {Filter, FilterEntry} from 'src/types'

type EntityQueryReturn = {
  value: any[]
  nextIndex: number
}

export type EntityQueryCallback = (o: EntityQueryCallbackParams) => Promise<EntityQueryReturn>
export type EntityQueryCallbackParams = {
  index?: number
  batchSize?: number
  address?: string
  topic?: string
  needUpdate?: string
}

export const listByBlockNumber = <T>(
  f: (f: Filter) => Promise<T[]>,
  extraFilters?: ((params: EntityQueryCallbackParams) => FilterEntry)[]
) => async (params: EntityQueryCallbackParams) => {
  const filters = extraFilters ? extraFilters.map((f) => f(params)) : []
  const filter: Filter = {
    limit: params.batchSize,
    offset: 0,
    orderDirection: 'asc',
    orderBy: 'block_number',
    filters: [
      {
        type: 'gt',
        property: 'block_number',
        value: params.index || 0,
      },
      ...filters,
    ],
  }
  const value = await f(filter)
  // @ts-ignore
  const nextIndex = value.length ? +value[value.length - 1].blockNumber : -1
  return {
    value,
    nextIndex,
  }
}

export const listByOffset = <T>(
  f: (f: Filter) => Promise<T[]>,
  extraFilters?: ((params: EntityQueryCallbackParams) => FilterEntry)[]
) => async (params: EntityQueryCallbackParams) => {
  const filters = extraFilters ? extraFilters.map((f) => f(params)) : []
  const filter: Filter = {
    limit: params.batchSize,
    offset: params.index,
    filters,
  }
  const value = await f(filter)
  // @ts-ignore
  const nextIndex = params.index + params.batchSize
  return {
    value,
    nextIndex,
  }
}

type EqualFields = 'address' | 'needUpdate'
export const withEqual = (property: EqualFields) => (params: EntityQueryCallbackParams) => {
  const value = params[property]
  if (!value) {
    throw new Error(`${value} field must be defined`)
  }

  return {
    value: `'${value}'`,
    type: 'eq',
    property,
  } as FilterEntry
}
