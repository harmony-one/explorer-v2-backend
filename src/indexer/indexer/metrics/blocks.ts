import {ShardID} from 'src/types'
import {config} from 'src/config'

const {shards} = config.indexer

interface BlockMetrics {
  lastBlockNumber: number
  lastBlockUpdatedAt: number
}

const metrics: Record<ShardID, BlockMetrics> = shards.reduce((acc, shardId) => {
  acc[shardId] = {
    lastBlockNumber: 0,
    lastBlockUpdatedAt: 0,
  }
  return acc
}, {} as any)

export const addBlock = (shardId: ShardID, blockNumber: number) => {
  if (metrics[shardId].lastBlockNumber !== blockNumber) {
    metrics[shardId].lastBlockNumber = blockNumber
    metrics[shardId].lastBlockUpdatedAt = Date.now()
  }
}

export const getBlocksMetrics = (shardId: ShardID) => metrics[shardId]
