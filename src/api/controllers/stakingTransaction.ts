import {storesAPI as stores} from 'src/store'
import {ShardID} from 'src/types/blockchain'
import {validator} from 'src/utils/validators/validators'
import {
  is64CharHexHash,
  isBlockNumber,
  isOrderDirection,
  isOrderBy,
  isShard,
  isOffset,
  isLimit,
  isOneOf,
  isFilters,
  Void,
} from 'src/utils/validators'
import {
  Filter,
  TransactionQueryField,
  TransactionQueryValue,
  StakingTransactionQueryField,
} from 'src/types/api'

// todo last txs with memory cache

export async function getStakingTransactionsByField(
  shardID: ShardID,
  field: StakingTransactionQueryField,
  value: TransactionQueryValue
) {
  validator({
    field: isOneOf(field, ['block_number', 'block_hash', 'hash']),
  })
  if (field === 'block_number') {
    validator({
      value: isBlockNumber(value),
    })
  } else {
    validator({
      value: is64CharHexHash(value),
    })
  }

  const txs = await stores[shardID].staking.getStakingTransactionsByField(field, value)
  if (!txs!.length) {
    return null
  }

  if (['hash'].includes(field)) {
    return txs![0]
  }

  return txs
}

export async function getStakingTransactions(shardID: ShardID, filter?: Filter) {
  validator({
    shardID: isShard(shardID),
  })

  if (filter) {
    validator({
      offset: isOffset(filter.offset),
      limit: isLimit(filter.limit),
      orderBy: isOrderBy(filter.orderBy, ['block_number']),
      orderDirection: isOrderDirection(filter.orderDirection),
      filter: isFilters(filter.filters, ['block_number']),
    })
  } else {
    filter = {
      offset: 0,
      limit: 10,
      orderBy: 'block_number',
      orderDirection: 'desc',
      filters: [],
    }
  }
  return await stores[shardID].staking.getStakingTransactions(filter)
}
