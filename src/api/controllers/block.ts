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
} from 'src/utils/validators'
import {Filter} from 'src/types/api'
import {withCache} from './cache'

export async function getBlockByNumber(shardID: ShardID, blockNumber: number) {
  validator({
    shardID: isShard(shardID),
    blockNumber: isBlockNumber(blockNumber),
  })

  return await withCache(
    ['getBlockByNumber', arguments],
    () => stores[shardID].block.getBlockByNumber(blockNumber),
    1000 * 10
  )
}

export async function getBlockByHash(shardID: ShardID, blockHash: string) {
  validator({
    shardID: isShard(shardID),
    blockHash: is64CharHexHash(blockHash),
  })

  return await withCache(
    ['getBlockByHash', arguments],
    () => stores[shardID].block.getBlockByHash(blockHash),
    2000
  )
}

export async function getBlocks(shardID: ShardID, filter?: Filter) {
  validator({
    shardID: isShard(shardID),
  })

  if (filter) {
    validator({
      offset: isOffset(filter.offset),
      limit: isLimit(filter.limit),
      orderBy: isOrderBy(filter.orderBy, ['number']),
      orderDirection: isOrderDirection(filter.orderDirection),
      filter: isFilters(filter.filters, ['number']),
    })
  } else {
    filter = {
      offset: 0,
      limit: 10,
      orderBy: 'number',
      orderDirection: 'desc',
      filters: [],
    }
  }

  return await withCache(
    ['getBlocks', arguments],
    () => stores[shardID].block.getBlocks(filter!),
    2000
  )
}
