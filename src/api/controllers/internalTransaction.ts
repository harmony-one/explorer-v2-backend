import {storesAPI as stores} from 'src/store'
import {BlockHexNumber, InternalTransaction, ShardID, Transaction} from 'src/types/blockchain'
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

export async function getInternalTransactionsByField(
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

  return await withCache(['getInternalTransactionsByField', arguments], () =>
    stores[shardID].internalTransaction.getInternalTransactionsByField(field, value)
  )
}

export async function getTraceBlock(shardID: ShardID, blockHexNumber: BlockHexNumber) {
  const blockNumber = parseInt(blockHexNumber, 16)

  validator({
    shardID: isShard(shardID),
    blockNumber: isBlockNumber(blockNumber),
  })

  return await withCache(['getTraceBlock', arguments], () =>
    stores[shardID].internalTransaction.getTraceBlock(blockNumber)
  )
}
