import * as RPCClient from 'src/indexer/rpc/client'
import {urls, RPCUrls} from 'src/indexer/rpc/RPCUrls'
import {ShardID, Block, BlockNumber} from 'src/types/blockchain'
import {arrayChunk} from 'src/utils/arrayChunk'
import {logger} from 'src/logger'
import LoggerModule from 'zerg/dist/LoggerModule'
import {stores} from 'src/store'
import {logTime} from 'src/utils/logTime'
import {PostgresStorage} from 'src/store/postgres'
import {AddressIndexer} from './addressIndexer'
import {contractAddressIndexer} from './сontractAddressIndexer'
import {internalTransactionsIgnoreListFilter} from './ignoreList/internalTransactionIgnoreList'
import * as monitorTransfers from './metrics/transfers'

const approximateBlockMintingTime = 2000
const maxBatchCount = 100

// todo to config
const blockRange = 1

const range = (num: number) => Array(num).fill(0)

export class BlockIndexer {
  readonly shardID: ShardID
  readonly initialStartBlock: number
  private l: LoggerModule
  private batchCount: number
  readonly store: PostgresStorage

  constructor(shardID: ShardID, batchCount: number = maxBatchCount, initialStartBlock: number = 0) {
    this.l = logger(module, `shard${shardID}`)
    this.shardID = shardID
    this.initialStartBlock = initialStartBlock
    this.batchCount = batchCount
    this.l.info('Created')
    this.store = stores[shardID]
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
      const latestSyncedBlock = await store.indexer.getLastIndexedBlockNumber()

      const startBlock =
        latestSyncedBlock && latestSyncedBlock > 0 ? latestSyncedBlock + 1 : this.initialStartBlock

      // todo check if node stuck
      const latestBlockchainBlock = (await RPCClient.getBlockByNumber(shardID, 'latest', false))
        .number

      const addressIndexer = AddressIndexer()

      const getBlocks = (from: BlockNumber, to: BlockNumber) => {
        return RPCClient.getBlocks(shardID, from, to)
      }

      const filterBlocks = (blocks: Block[]) => {
        return blocks.map((b) => ({
          ...b,
          transactions: b.transactions.filter(internalTransactionsIgnoreListFilter),
        }))
      }

      const addBlocks = (blocks: Block[]) => {
        return Promise.all(
          blocks.map(async (block) => {
            await store.block.addBlock(block)
            return block
          })
        )
      }

      const addTraceBlocks = async (blocks: Block[]) => {
        return Promise.all(
          blocks.map(async (block) => {
            if (!block.transactions.length) {
              return Promise.resolve(block)
            }

            if (!block.transactions.reduce((a, b) => a || b.input.length > 3, false)) {
              return Promise.resolve(block)
            }

            const txs = await RPCClient.traceBlock(shardID, block.number)
            txs.forEach((tx) => {
              addressIndexer.add(block, tx.transactionHash, 'internal_transaction', tx.from, tx.to)
            })

            txs.map((tx) => monitorTransfers.addInternalTransaction(tx, block))

            // await Promise.all(txs.map((tx) => store.internalTransaction.addInternalTransaction(tx)))
            const chunks = arrayChunk(txs, 100)
            for (const chunk of chunks) {
              // await Promise.all(chunk.map((tx: any) => store.internalTransaction.addInternalTransaction(tx)))
              await store.internalTransaction.addInternalTransactions(chunk)
            }

            await Promise.all(
              txs
                .map(contractAddressIndexer)
                .filter((contract) => contract)
                .map((contract) => store.contract.addContract(contract!))
            )

            return block
          })
        )
      }

      const addTransactions = (blocks: Block[]) => {
        return Promise.all(
          blocks.map(async (block) => {
            block.transactions.map(monitorTransfers.addTransaction)

            block.transactions.forEach((tx) => {
              // todo handle empty create to addresses
              // 0x262492c68baaf4a3123cf30d229b5d3907204ba723a521b3d48b6d84ef344640
              addressIndexer.add(block, tx.ethHash, 'transaction', tx.from, tx.to)
            })
            await store.transaction.addTransactions(block.transactions)
            return block
          })
        )
      }

      const addStakingTransactions = (blocks: Block[]) => {
        return Promise.all(
          blocks.map(async (block) => {
            block.stakingTransactions.map(monitorTransfers.addStakingTransaction)
            block.stakingTransactions.forEach((tx) => {
              addressIndexer.add(
                block,
                tx.hash,
                'staking_transaction',
                tx.msg.delegatorAddress,
                tx.msg.validatorAddress
              )
            })

            const stakingTransactionsWithAmount = await Promise.all(
              block.stakingTransactions.map(async (tx) => {
                if (tx.type !== 'CollectRewards') {
                  const amountHex = tx.msg.amount || 0
                  const amount = BigInt(amountHex).toString()
                  return {...tx, amount}
                }

                // get receipt for CollectReward type of staking transactions to get reward amount (tx.logs[0].data)
                const res = await RPCClient.getTransactionReceipt(shardID, tx.hash)
                const amountHex = (res.logs && res.logs[0] && res.logs[0].data) || 0
                const amount = BigInt(amountHex).toString()
                return {...tx, amount}
              })
            )

            await store.staking.addStakingTransactions(stakingTransactionsWithAmount)
            return block
          })
        )
      }

      const addAddresses = () => {
        const entries = addressIndexer.get()
        return Promise.all(
          entries.map((e) => {
            // hack, sometimes addAddress2Transaction stucks, so we set a timeout here
            return Promise.race([
              store.address.addAddress2Transaction(e),
              // new Promise((resolve) => setTimeout(resolve, 300)),
            ])
          })
        )
      }

      const blocks = await Promise.all(
        range(this.batchCount).map(async (_, i) => {
          const from = startBlock + i * blockRange
          const to = Math.min(from + blockRange - 1, latestBlockchainBlock)

          if (from > latestBlockchainBlock) {
            return Promise.resolve([] as Block[])
          }

          this.l.debug(`Processing [${from}, ${to}] ${to - from + 1} blocks...`)

          return await getBlocks(from, to)
            .then(addBlocks)
            .then(addTransactions)
            .then(addStakingTransactions)
            .then(filterBlocks)
            .then(addTraceBlocks)
        })
      ).then((res) => res.flatMap((b) => b).filter((b) => b))

      // removed await so no need to wait
      await addAddresses()

      const lastFetchedBlockNumber = blocks.reduce((a, b) => (a < b.number ? b.number : a), 0)
      const transactionsCount = blocks.reduce((a, b) => a + b.transactions.length, 0)
      const stakingTransactionsCount = blocks.reduce((a, b) => a + b.stakingTransactions.length, 0)

      const failedCount = RPCUrls.getFailedCount(shardID) - failedCountBefore

      if (lastFetchedBlockNumber > 0) {
        await store.indexer.setLastIndexedBlockNumber(lastFetchedBlockNumber)
      }

      const syncedToBlock = Math.min(
        lastFetchedBlockNumber,
        startBlock + blockRange * this.batchCount
      )

      this.l.info(
        `Processed [${startBlock}, ${syncedToBlock}] ${
          blocks.length
        } blocks. ${transactionsCount} txs. ${stakingTransactionsCount} staking txs. Done in ${batchTime()}. Failed requests ${failedCount}`
      )

      const u = urls[shardID]
      this.l.debug('RPC queries', {
        queries: u.map((s) => s.totalQueries),
        failed: u.map((s) => s.failedRequests),
      })
      u.forEach((a) => {
        a.totalQueries = 0
      })

      if (blocks.length >= syncedToBlock - startBlock + 1 && blocks.length >= blockRange) {
        if (failedCount > 0 || batchTime().val > 60000) {
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
