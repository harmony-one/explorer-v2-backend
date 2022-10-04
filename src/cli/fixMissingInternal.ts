import {config, init as configInit} from 'src/config'
import {Block, BlockNumber, InternalTransaction, ShardID} from 'src/types'
import {logger} from 'src/logger'
import {stores} from 'src/store'
import * as RPCClient from 'src/indexer/rpc/client'
import {urls, RPCUrls} from 'src/indexer/rpc/RPCUrls'
import {arrayChunk, defaultChunkSize} from 'src/utils/arrayChunk'
import {internalTransactionsIgnoreListFilter} from 'src/indexer/indexer/ignoreList/internalTransactionIgnoreList'

const l = logger(module)

const getBlocks = (from: BlockNumber, to: BlockNumber) => {
  return RPCClient.getBlocks(0, from, to)
}

const getBlocksTrace = (blocks: Block[]) => {
  return Promise.all(blocks.map((block) => RPCClient.traceBlock(0, block.number)))
}

const filterBlocks = (blocks: Block[]) => {
  return blocks.map((b) => ({
    ...b,
    transactions: b.transactions.filter(internalTransactionsIgnoreListFilter),
  }))
}

let internalCount = 0

const addTraceBlocks = async (blocks: Block[], blocksInternalTxs: InternalTransaction[][]) => {
  return Promise.all(
    blocks.map(async (block, index) => {
      if (!block.transactions.length) {
        return Promise.resolve([])
      }
      if (!block.transactions.reduce((a, b) => a || b.input.length > 3, false)) {
        const internalTxs = blocksInternalTxs[index]
        internalCount += internalTxs.length
        const chunks = arrayChunk(internalTxs, defaultChunkSize)
        for (const chunk of chunks) {
          await Promise.all(
            chunk.map((tx: any) => stores[0].internalTransaction.addInternalTransaction(tx))
          )
        }
        return Promise.resolve(internalTxs)
      }
      return Promise.resolve([])
    })
  )
}

const fixMissingInternal = async (shardID: ShardID) => {
  const l = logger(module, `shard${shardID}`)

  const start = 31643680
  const end = 32165000
  const allInternalTxs: InternalTransaction[] = []

  const batchSize = 1000
  let iteration = 0
  for (let i = start; i < end; i += batchSize) {
    const from = i
    const to = i + batchSize - 1

    l.info(`Process ${from}-${to} [completed ${from - start} blocks]`)
    const blocks = await getBlocks(from, to)
    const blocksInternalTxs = await getBlocksTrace(blocks)
    const data = await addTraceBlocks(filterBlocks(blocks), blocksInternalTxs)
    const internalTxs = data.flat()
    if (internalTxs.length > 0) {
      allInternalTxs.push(...internalTxs)
    }
    const percent = ((iteration * batchSize) / (end - start)) * 100
    l.info(
      `Written internal txs count: ${internalTxs.length}, total: ${allInternalTxs.length}, %${percent}`
    )
    iteration++

    if (iteration % 100 === 0) {
      console.log(
        'allInternalTxs',
        allInternalTxs.map((tx) => tx.transactionHash)
      )
    }
  }

  console.log(
    'allInternalTxs',
    allInternalTxs.map((tx) => tx.transactionHash)
  )
}

export const indexer = async () => {
  l.info(`Fix Missing Internal Task starting... Shards[${config.indexer.shards.join(', ')}]`)

  const shards = config.indexer.shards

  await Promise.all(shards.map(checkChainID))
  await Promise.all(shards.map((s) => fixMissingInternal(s)))
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
