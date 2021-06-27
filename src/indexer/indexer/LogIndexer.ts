import {config} from 'src/config'
import * as RPCClient from 'src/indexer/rpc/client'
import {urls, RPCUrls} from 'src/indexer/rpc/RPCUrls'
import {ShardID, Log} from 'src/types/blockchain'

import {logger} from 'src/logger'
import LoggerModule from 'zerg/dist/LoggerModule'
import {stores} from 'src/store'
import {logTime} from 'src/utils/logTime'
import {PostgresStorage} from 'src/store/postgres'

const approximateBlockMintingTime = 2000
const blockRange = 10
const maxBatchCount = 100

const range = (num: number) => Array(num).fill(0)

// todo make a part of blockindexer
export class LogIndexer {
  readonly shardID: ShardID
  private l: LoggerModule
  private batchCount = 10
  readonly store: PostgresStorage

  constructor(shardID: ShardID) {
    if (shardID !== 0) {
      throw new Error('Only shard #0 is currently supported')
    }

    this.l = logger(module, `shard${shardID}`)
    this.shardID = shardID
    this.store = stores[shardID]
    this.l.info('Created')
  }

  increaseBatchCount = () => {
    this.batchCount = Math.min(Math.ceil(this.batchCount * 1.1), maxBatchCount)
    this.l.debug(`Batch increased to ${this.batchCount}`)
  }

  decreaseBatchCount = () => {
    this.batchCount = Math.max(~~(this.batchCount * 0.9), 1)
    this.l.debug(`Batch decreased to ${this.batchCount}`)
  }

  loop = async () => {
    try {
      const shardID = this.shardID
      const store = this.store
      const batchTime = logTime()
      const failedCountBefore = RPCUrls.getFailedCount(shardID)
      const latestSyncedBlock = await store.indexer.getLastIndexedLogsBlockNumber()
      // todo check in full sync
      const startBlock = latestSyncedBlock > 0 ? latestSyncedBlock + 1 : 0
      const latestBlockchainBlock = (await RPCClient.getBlockByNumber(shardID, 'latest', false))
        .number

      const addLogs = (logs: Log[]) => {
        return Promise.all(
          logs.map(async (log) => {
            await store.log.addLog(log)
            return log
          })
        )
      }

      const res = await Promise.all(
        range(this.batchCount).map(async (_, i) => {
          const from = startBlock + i * blockRange
          const to = Math.min(from + blockRange - 1, latestBlockchainBlock)

          if (from > latestBlockchainBlock) {
            return Promise.resolve(null)
          }

          return await RPCClient.getLogs(shardID, from, to).then(addLogs)
        })
      )

      const logs = res.filter((l) => l) as Log[][]
      const logsLength = logs.reduce((a, b) => a + b.length, 0)
      const failedCount = RPCUrls.getFailedCount(shardID) - failedCountBefore
      const syncedToBlock = Math.min(
        latestBlockchainBlock,
        startBlock + blockRange * this.batchCount
      )

      this.l.info(
        `Processed [${startBlock},${syncedToBlock}] ${Math.max(
          syncedToBlock - startBlock,
          1
        )} blocks. ${logsLength} log entries. Done in ${batchTime()}.`
      )

      await store.indexer.setLastIndexedLogsBlockNumber(syncedToBlock)

      if (logs.length === this.batchCount) {
        if (failedCount > 0) {
          this.decreaseBatchCount()
        } else {
          this.increaseBatchCount()
        }

        process.nextTick(this.loop)
      } else {
        this.decreaseBatchCount()
        setTimeout(this.loop, approximateBlockMintingTime)
      }
    } catch (err) {
      this.l.warn(`Batch failed. Retrying in ${approximateBlockMintingTime}ms`, err.message || err)
      this.decreaseBatchCount()
      setTimeout(this.loop, approximateBlockMintingTime)
    }
  }
}
