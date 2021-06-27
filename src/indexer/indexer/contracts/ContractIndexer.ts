import {logger} from 'src/logger'
import LoggerModule from 'zerg/dist/LoggerModule'
import {stores} from 'src/store'
import {EntityIterator} from 'src/indexer/utils/EntityIterator'
import {tasks} from './tasks'
import {ContractTracker} from 'src/indexer/indexer/contracts/types'
import {PostgresStorage} from 'src/store/postgres'
import {EntityIteratorEntities} from 'src/indexer/utils/EntityIterator/entities'

const syncingIntervalMs = 1000 * 60 * 5

export class ContractIndexer {
  readonly l: LoggerModule
  readonly ls: Record<string, LoggerModule>
  readonly store: PostgresStorage

  constructor() {
    this.store = stores[0]
    this.l = logger(module)
    this.l.info(`Created [${tasks.map((t) => t.name).join(', ')}]`)
    this.ls = tasks
      .map((t) => t.name)
      .reduce((o, name) => {
        o[name] = logger(module, name)
        return o
      }, {} as Record<string, LoggerModule>)
  }

  // iterate all contract entries stored in db and add records for tracked contracts erc20, erc721, etc
  private addContracts = async (task: ContractTracker<any>) => {
    const latestSyncedBlockIndexerBlock = await this.store.indexer.getLastIndexedBlockNumberByName(
      'blocks'
    )

    const latestSyncedBlock = await this.store.indexer.getLastIndexedBlockNumberByName(
      `${task.name}_contracts`
    )
    const startBlock = latestSyncedBlock && latestSyncedBlock > 0 ? latestSyncedBlock + 1 : 0

    const {batchSize, process} = task.addContract
    this.ls[task.name].info(`Syncing contracts from block ${startBlock}`)
    const contractsIterator = EntityIterator('contracts', {
      batchSize,
      index: startBlock,
    })

    for await (const contracts of contractsIterator) {
      await Promise.all(contracts.map((c) => process(this.store, c)))

      if (contracts.length) {
        const syncedToBlock = +contracts[contracts.length - 1].blockNumber
        await this.store.indexer.setLastIndexedBlockNumberByName(
          `${task.name}_contracts`,
          syncedToBlock
        )
      }
    }

    await this.store.indexer.setLastIndexedBlockNumberByName(
      `${task.name}_contracts`,
      latestSyncedBlockIndexerBlock
    )
  }

  // track logs for specific address
  trackEvents = async (task: ContractTracker<any>) => {
    const l = this.ls[task.name] // .info(`Syncing logs from block ${startBlock}`)

    const latestSyncedBlockIndexerBlock = await this.store.indexer.getLastIndexedBlockNumberByName(
      'logs'
    )

    const tokensIterator = EntityIterator(
      (task.tableName as EntityIteratorEntities) || (task.name as EntityIteratorEntities),
      {
        batchSize: 1,
        index: 0,
      }
    )

    const {batchSize, process} = task.trackEvents

    for await (const tokens of tokensIterator) {
      if (!tokens.length) {
        break
      }

      const token = tokens[0]

      const latestSyncedBlock = await task.trackEvents.getLastSyncedBlock(this.store, token)
      const startBlock = latestSyncedBlock && latestSyncedBlock > 0 ? latestSyncedBlock + 1 : 0
      let latestSyncedTokenBlock = latestSyncedBlock

      const logsIterator = EntityIterator('logs', {
        batchSize,
        index: startBlock,
        address: token.address,
      })

      l.info(`Getting logs for "${token.name}" ${token.address} from block ${startBlock}`)

      for await (const logs of logsIterator) {
        if (!logs.length) {
          continue
        }

        l.info(`Processing ${logs.length} logs`)
        try {
          await process(this.store, logs, {token})

          latestSyncedTokenBlock = Math.max(
            latestSyncedTokenBlock,
            logs.reduce((acc, o) => (acc > o.blockNumber ? acc : o.blockNumber), 0)
          )
          if (latestSyncedTokenBlock > 0) {
            await task.trackEvents.setLastSyncedBlock(this.store, token, latestSyncedTokenBlock)
          }
        } catch (err) {
          this.ls[task.name].warn(`Syncing logs for ${token.address} failed`, {
            token,
            err: err.message || err,
          })
        }
      }

      await task.trackEvents.setLastSyncedBlock(this.store, token, latestSyncedBlockIndexerBlock)
    }
  }

  loop = async () => {
    // todo only when blocks synced

    // todo in same time
    for (const task of tasks) {
      const l = this.ls[task.name]
      try {
        l.info('Starting...')

        if (typeof task.addContract.process === 'function') {
          await this.addContracts(task)
        }

        if (typeof task.trackEvents.process === 'function') {
          await this.trackEvents(task)
        }

        if (typeof task.onFinish === 'function') {
          await task.onFinish(this.store)
        }
      } catch (err) {
        l.warn('Batch failed', err.message || err)
      }
    }
    setTimeout(this.loop, syncingIntervalMs)
  }
}
