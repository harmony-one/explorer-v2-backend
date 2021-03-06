import http from 'http'
import express from 'express'
import {config} from 'src/config'
import {logger} from 'src/logger'
import {stores} from 'src/store'
import * as RPCClient from 'src/indexer/rpc/client'
import {cache as LRUCache} from 'src/api/controllers/cache'
import {getLastLogs} from 'src/logger/lastLogs'
import * as monitorTransfers from 'src/indexer/indexer/metrics/transfers'
import {getBlocksMetrics} from 'src/indexer/indexer/metrics/blocks'

const l = logger(module)

export const indexerServer = async () => {
  if (!config.indexer.infoWebServer.isEnabled) {
    l.debug(`Indexer info web server disabled`)
    return
  }

  const api = express()
  const server = http.createServer(api)

  api.get('/transfers', (req, res) => {
    return res.json(monitorTransfers.getEntries())
  })

  api.get('/', async (req, res) => {
    const {shards, isSyncedThreshold} = config.indexer

    const lastSyncedBlocks = await Promise.all(
      shards.map(async (shardID) => {
        const {lastBlockUpdatedAt} = getBlocksMetrics(shardID)
        const rpcHeight = (await RPCClient.getBlockByNumber(shardID, 'latest', false)).number

        const indexerHeight = await stores[shardID].indexer.getLastIndexedBlockNumber()
        let isSynced = false
        if (indexerHeight) {
          // isSynced should be "false" if RPC height lower that indexer height
          const isRpcAheadOfIndexer = rpcHeight >= indexerHeight
          isSynced = isRpcAheadOfIndexer && rpcHeight - indexerHeight < isSyncedThreshold
        }
        const isStuck = lastBlockUpdatedAt > 0 && Date.now() - lastBlockUpdatedAt >= 60 * 1000
        return {shardID, indexerHeight, rpcHeight, threshold: isSyncedThreshold, isSynced, isStuck}
      })
    )
    const state = {lastSyncedBlocks}

    const lastLogs = getLastLogs()

    const cache = {entries: LRUCache.itemCount}
    // be sure to remove passwords etc
    const json = {config: {...config, store: {}}, state, cache, lastLogs}
    res.json(json)
  })

  const close = () => server.close()

  server.listen(config.indexer.infoWebServer.port, () => {
    l.info(
      `Indexer info web server listening at http://localhost:${config.indexer.infoWebServer.port}`
    )
  })

  return close
}
