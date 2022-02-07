import {BlockIndexer} from 'src/indexer/indexer/BlockIndexer'
import {config, init as configInit} from 'src/config'
import {ShardID} from 'src/types'
import {logger} from 'src/logger'
import {stores} from 'src/store'
import * as RPCClient from 'src/indexer/rpc/client'
import {urls, RPCUrls} from 'src/indexer/rpc/RPCUrls'
import {arrayChunk, defaultChunkSize} from "src/utils/arrayChunk"

const l = logger(module)

const fixMissingBlocks = async (shardID: ShardID) => {
    const l = logger(module, `shard${shardID}`)
    const store = stores[shardID]
    const latestIndexedBlock = await store.indexer.getLastIndexedBlockNumber()
    const missingBlocks = await store.utils.getMissingBlocks(0, latestIndexedBlock!)

    l.info(`Found ${missingBlocks.length} missing blocks in [0,${latestIndexedBlock}] range`)

    const chunks = arrayChunk(missingBlocks, 10)
    for (const chunk of chunks) {
        l.info(`Process ${chunk} from ${chunks.length}`)
        await Promise.all(
            chunk.map((b: any) => {
                const bi = new BlockIndexer(shardID, 1, 0, b)
                return bi.loop()
            })
        )
    }
}

export const indexer = async () => {
        l.info(`Fix Missing Blocks Task starting... Shards[${config.indexer.shards.join(', ')}]`)

        const shards = config.indexer.shards

        await Promise.all(shards.map(checkChainID))
        await Promise.all(shards.map((s) => fixMissingBlocks(s)))
    }

;(async () => {
    await configInit()
    indexer()
})()

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
