import {
  Filter,
  ShardID,
  Address,
  ContractQueryField,
  ContractQueryValue,
  TransactionQueryValue,
  AddressTransactionType,
  InternalTransaction,
  FilterEntry,
} from 'src/types'
import {validator} from 'src/utils/validators/validators'
import {
  is64CharHexHash,
  isAddress,
  isBlockNumber,
  isFilters,
  isLimit,
  isOffset,
  isOneOf,
  isOrderBy,
  isOrderDirection,
  isShard,
} from 'src/utils/validators'
import {storesAPI as stores} from 'src/store'
import {withCache} from 'src/api/controllers/cache'
import {config} from 'src/config'

export async function getRelatedTransactionsByType(
  shardID: ShardID,
  address: Address,
  type: AddressTransactionType,
  filter?: Filter
) {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
    type: isOneOf(type, [
      'transaction',
      'staking_transaction',
      'internal_transaction',
      'erc20',
      'erc721',
    ]),
  })

  if (filter) {
    validator({
      offset: isOffset(filter.offset),
      limit: isLimit(filter.limit, 5000),
      orderBy: isOrderBy(filter.orderBy, ['block_number']),
      orderDirection: isOrderDirection(filter.orderDirection),
    })

    if (filter.filters) {
      validator({
        filter: isFilters(filter.filters, ['block_number', 'timestamp']),
      })
    }
  }

  // todo validation
  filter = {
    offset: filter ? filter.offset : 0,
    limit: filter ? filter.limit : 10,
    orderBy: 'block_number',
    orderDirection: 'desc',
    filters: filter && filter.filters ? filter.filters : [],
  }

  // filter.filters.push({
  //   value: `'${address}'`,
  //   type: 'eq',
  //   property: 'address',
  // })

  // HOTFIX: internal_transactions is not indexed for a block less than 23.000.000
  if (type === 'internal_transaction') {
    const blockNumberFilter: FilterEntry = {
      type: 'gte',
      property: 'block_number',
      value: config.api.internalTxsBlockNumberStart,
    }

    if (filter.filters.find((filter) => filter.property === 'block_number')) {
      filter.filters = filter.filters.map((filter) => {
        if (filter.property !== 'block_number') {
          return filter
        }
        return {
          ...filter,
          ...blockNumberFilter,
        }
      })
    } else {
      filter.filters.push(blockNumberFilter)
    }
  }

  return await withCache(
    ['getRelatedTransactionsByType', arguments],
    () => stores[shardID].address.getRelatedTransactionsByType(address, type, filter!),
    2000
  )
}

export async function getRelatedTransactionsCountByType(
  shardID: ShardID,
  address: Address,
  type: AddressTransactionType,
  filter: Filter
) {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
    type: isOneOf(type, [
      'transaction',
      'staking_transaction',
      'internal_transaction',
      'erc20',
      'erc721',
    ]),
  })

  filter = {
    offset: filter ? filter.offset : 0,
    limit: filter ? filter.limit : 10,
    orderBy: 'block_number',
    orderDirection: 'desc',
    filters: filter && filter.filters ? filter.filters : [],
  }

  return await withCache(
    ['getRelatedTransactionsCountByType', arguments],
    () => stores[shardID].address.getRelatedTransactionsCountByType(address, type, filter),
    1000 * 5
  )
}

export async function getContractsByField(
  shardID: ShardID,
  field: ContractQueryField,
  value: ContractQueryValue
): Promise<InternalTransaction[] | null> {
  validator({
    field: isOneOf(field, ['address', 'creator_address']),
  })
  validator({
    value: isAddress(value),
  })

  const res = await withCache(
    ['getContractByField', arguments],
    () => stores[shardID].contract.getContractByField(field, value),
    1000 * 10
  )

  if (field === 'address') {
    return res[0]
  }

  return res
}
