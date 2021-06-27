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
} from 'src/utils/validators'
import {
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
    field: isOneOf(field, ['block_number', 'transaction_hash', 'block_hash']),
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

  return await withCache(['getLogsByField', arguments], () =>
    stores[shardID].log.getLogsByField(field, value)
  )
}
