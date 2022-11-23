import {config} from 'src/config'
import {BlockIndexer} from './indexer/BlockIndexer'
import {LogIndexer} from './indexer/LogIndexer'
import {ContractIndexer} from 'src/indexer/indexer/contracts/ContractIndexer'
import {indexerServer} from 'src/indexer/server'

import {ShardID} from 'src/types'
import {logger} from 'src/logger'
import {stores} from 'src/store'
import * as RPCClient from 'src/indexer/rpc/client'
import {urls, RPCUrls} from 'src/indexer/rpc/RPCUrls'

import {statsIndexer} from 'src/indexer/indexer/metrics/stats'

const l = logger(module)

export const indexer = async () => {
  l.info(`Indexer starting... Shards[${config.indexer.shards.join(', ')}]`)

  const shards = config.indexer.shards

  await Promise.all(shards.map(checkChainID))

  if (config.indexer.isSyncingBlocksEnabled) {
    const blockIndexers = shards.map(
      (shardID) =>
        new BlockIndexer(
          shardID,
          config.indexer.batchCount,
          config.indexer.initialBlockSyncingHeight
        )
    )
    blockIndexers.forEach((b) => b.loop())
  }

  await indexerServer()

  // todo enabled flag config for the task
  if (config.indexer.shards.includes(0)) {
    statsIndexer()
  }

  if (config.indexer.isSyncingLogsEnabled && config.indexer.shards.includes(0)) {
    const logIndexer0 = new LogIndexer(0)
    logIndexer0.loop()
  }

  if (config.indexer.isSyncingLogsEnabledShard1 && config.indexer.shards.includes(0)) {
    const logIndexer1 = new LogIndexer(0)
    logIndexer1.loop()
  }

  if (config.indexer.isSyncingContractsEnabled && config.indexer.shards.includes(0)) {
    const contractIndexer0 = new ContractIndexer()
    contractIndexer0.loop()
  }

  if (config.indexer.isSyncingContractsEnabledShard1 && config.indexer.shards.includes(0)) {
    const contractIndexer1 = new ContractIndexer()
    contractIndexer1.loop()
  }
}

const checkChainID = async (shardID: ShardID) => {
  const u = urls[shardID]
  const chainID = await stores[shardID].indexer.getChainID()

  const validate = (o: RPCUrls) =>
    RPCClient.getChainID(shardID).then((nodeChainID) => {
      if (!+chainID) {
        l.info(`Chain ID set to ${nodeChainID}`)
        return stores[shardID].indexer.updateChainID(nodeChainID)
      }
      // todo fix condition
      if (nodeChainID !== chainID && nodeChainID !== chainID + shardID) {
        throw new Error(
          `Wrong chain. ${o.url} returned chain ID ${nodeChainID}. Expected: ${chainID}.`
        )
      }
    })

  await Promise.all(u.map(validate))
}

process.on('unhandledRejection', (reason, p) => {
  l.error(`Unhandled Rejection at: Promise', ${p}, 'reason:', ${reason}`)
})
