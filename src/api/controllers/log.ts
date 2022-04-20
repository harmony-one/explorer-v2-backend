import {storesAPI as stores} from 'src/store'
import {InternalTransaction, ShardID, Transaction} from 'src/types/blockchain'
import {isHexString, validator} from 'src/utils/validators/validators'
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
  isTransactionHash,
} from 'src/utils/validators'
import {
  EthGetLogFilter,
  EthGetLogParams,
  Filter,
  InternalTransactionQueryField,
  TransactionQueryField,
  TransactionQueryValue,
} from 'src/types/api'
import {withCache} from 'src/api/controllers/cache'
import {config} from 'src/config'

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

  return await withCache(
    ['getDetailedLogsByField', arguments],
    () => stores[shardID].log.getDetailedLogsByField(field, value, limit, offset),
    10000
  )
}

export async function ethGetLogs(shardID: ShardID, params: EthGetLogParams): Promise<any> {
  const {fromBlock, toBlock, ...restParams} = params

  let cacheMaxAge = 2000
  if (params.blockhash || (fromBlock && toBlock)) {
    cacheMaxAge = 0 // Set cache forever is blocks range is presented in request
  }

  const filter: EthGetLogFilter = {...restParams}

  if (params.blockhash) {
    if (params.fromBlock || params.toBlock) {
      throw new Error(
        'Cannot specify both BlockHash and FromBlock/ToBlock, choose one or the other'
      )
    }
    validator({
      blockhash: is64CharHexHash(params.blockhash),
    })
  } else {
    const latestBlockNumber = await withCache(
      ['getLatestBlockNumber', arguments],
      () => stores[shardID].block.getLatestBlockNumber(),
      2000
    )
    let from = latestBlockNumber
    if (fromBlock && fromBlock !== 'latest') {
      validator({
        fromBlock: () => [isHexString(fromBlock)],
      })
      from = parseInt(fromBlock, 16)
    }
    let to = latestBlockNumber
    if (toBlock && toBlock !== 'latest') {
      validator({
        toBlock: () => [isHexString(toBlock)],
      })
      to = parseInt(toBlock, 16)
    }

    const blocksRangeLimit = config.api.json_rpc.ethGetLogsLimit
    if (to >= from && to - from > blocksRangeLimit) {
      throw new Error(`GetLogs query must be smaller than size ${blocksRangeLimit}`)
    }

    filter.from = from
    filter.to = to
  }

  if (params.address) {
    if (Array.isArray(params.address)) {
      params.address.forEach((a) => {
        validator({
          address: isAddress(a),
        })
      })
    } else {
      validator({
        address: isAddress(params.address),
      })
    }
  }

  if (params.topics) {
    if (Array.isArray(params.topics)) {
      params.topics.forEach((topic) => {
        validator({
          topics: isTransactionHash(topic),
        })
      })
    }
  }

  return await withCache(
    ['ethGetLogs', arguments],
    () => stores[shardID].log.ethGetLogs(filter),
    cacheMaxAge
  )
}
