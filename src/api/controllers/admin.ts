import {ShardID} from 'src/types/blockchain'
import {validator} from 'src/utils/validators/validators'
import {isBlockNumber, isShard} from 'src/utils/validators'
import {BlockIndexer} from 'src/indexer/indexer/BlockIndexer'
import {LogIndexer} from 'src/indexer/indexer/LogIndexer'
import {logger} from 'src/logger'

const l = logger(module, 'adminController')

export async function reindexBlock(shardID: ShardID, blockNumber: number) {
  validator({
    shardID: isShard(shardID),
    blockNumber: isBlockNumber(blockNumber),
  })

  const timeStart = Date.now()
  const blockIndexer = new BlockIndexer(shardID, 1, blockNumber, blockNumber)
  const logsIndexer = new LogIndexer(shardID, 1, blockNumber, blockNumber)

  try {
    const blockNumberSynced = await blockIndexer.loop()
    const logsNumberSynced = await logsIndexer.loop()

    return {
      blockNumber: blockNumberSynced,
      logsBlocksNumber: logsNumberSynced,
      elapsedTime: `${Date.now() - timeStart} ms`,
    }
  } catch (e) {
    l.info(`Cannot reindex block number ${blockNumber} shardID ${shardID}: "${e.message}"`)

    return {
      error: e.message || 'Unknown error',
    }
  }
}
