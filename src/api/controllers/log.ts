import {storesAPI as stores} from 'src/store'
import {InternalTransaction, ShardID, Transaction} from 'src/types/blockchain'
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
  isAddress,
} from 'src/utils/validators'
import {
  EthGetLogParams,
  Filter,
  InternalTransactionQueryField,
  TransactionQueryField,
  TransactionQueryValue,
} from 'src/types/api'
import {withCache} from 'src/api/controllers/cache'

export async function getLogsByField(
  shardID: ShardID,
  field: InternalTransactionQueryField,
  value: TransactionQueryValue
): Promise<InternalTransaction[] | null> {
  validator({
    field: isOneOf(field, ['block_number', 'transaction_hash', 'block_hash', 'address']),
  })
  if (field === 'block_number') {
    validator({
      value: isBlockNumber(value),
    })
  } else if (field === 'address') {
    validator({
      value: isAddress(value),
    })
  } else {
    validator({
      value: is64CharHexHash(value),
    })
  }

  return await withCache(['getLogsByField', arguments], () =>
    stores[shardID].log.getLogsByField(field, value)
  )
}

export async function getDetailedLogsByField(
  shardID: ShardID,
  field: InternalTransactionQueryField,
  value: TransactionQueryValue,
  limit = 10,
  offset = 0
): Promise<InternalTransaction[] | null> {
  validator({
    field: isOneOf(field, ['block_number', 'transaction_hash', 'block_hash', 'address']),
  })
  if (field === 'block_number') {
    validator({
      value: isBlockNumber(value),
    })
  } else if (field === 'address') {
    validator({
      value: isAddress(value),
    })
  } else {
    validator({
      value: is64CharHexHash(value),
    })
  }

  validator({
    limit: isLimit(limit, 10),
  })

  validator({
    offset: isOffset(offset),
  })

  return await withCache(['getDetailedLogsByField', arguments], () =>
    stores[shardID].log.getDetailedLogsByField(field, value, limit, offset)
  )
}

export async function ethGetLogs(shardID: ShardID, params: EthGetLogParams): Promise<any> {
  return stores[shardID].log.ethGetLogs(params)
}
