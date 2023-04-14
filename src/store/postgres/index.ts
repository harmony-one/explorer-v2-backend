import {Pool} from 'pg'
import {logger} from 'src/logger'
import {scheme} from './scheme'
import {IStorage} from 'src/store/interface'
import {logTime} from 'src/utils/logTime'
import {Query, PostgresStorageOptions} from './types'
import {PostgresStorageBlock} from './Block'
import {PostgresStorageLog} from './Log'
import {PostgresStorageStakingTransaction} from './StakingTransaction'
import {PostgresStorageTransaction} from './Transaction'
import {PostgresStorageIndexer} from 'src/store/postgres/Indexer'
import {PostgresStorageInternalTransaction} from 'src/store/postgres/InternalTransaction'
import {PostgresStorageAddress} from 'src/store/postgres/Address'
import {PostgresStorageContract} from 'src/store/postgres/Contract'
import LoggerModule from 'zerg/dist/LoggerModule'
import {ShardID, CountableEntities} from 'src/types'
import {fromSnakeToCamelResponse, mapNamingReverse} from 'src/store/postgres/queryMapper'
import {PostgresStorageERC20} from 'src/store/postgres/ERC20'
import {PostgresStorageSignature} from 'src/store/postgres/Signatures'
import {PostgresStorageMetrics} from 'src/store/postgres/Metrics'
import {PostgresStorageERC721} from 'src/store/postgres/ERC721'
import {PostgresStorageERC1155} from 'src/store/postgres/ERC1155'
import {PostgresStorageOneWalletMetrics} from 'src/store/postgres/OneWalletMetrics'
import {PostgresStorageUtils} from 'src/store/postgres/utils'

import {config} from 'src/config'

const defaultRetries = 2

const sleep = (time = 1000) => new Promise((r) => setTimeout(r, time))
const blockNumber7DayOld = (7 * 24 * 60 * 60) / 2

export class PostgresStorage implements IStorage {
  db: Pool
  block: PostgresStorageBlock
  log: PostgresStorageLog
  transaction: PostgresStorageTransaction
  internalTransaction: PostgresStorageInternalTransaction
  indexer: PostgresStorageIndexer
  staking: PostgresStorageStakingTransaction
  address: PostgresStorageAddress
  contract: PostgresStorageContract
  erc20: PostgresStorageERC20
  erc721: PostgresStorageERC721
  erc1155: PostgresStorageERC1155
  signature: PostgresStorageSignature
  metrics: PostgresStorageMetrics
  oneWalletMetrics: PostgresStorageOneWalletMetrics
  utils: PostgresStorageUtils

  isStarted = false
  isStarting = false
  l: LoggerModule
  options: PostgresStorageOptions
  shardID: ShardID

  constructor(options: PostgresStorageOptions) {
    this.shardID = options.shardID
    this.block = new PostgresStorageBlock(this.query)
    this.log = new PostgresStorageLog(this.query)
    this.transaction = new PostgresStorageTransaction(this.query)
    this.internalTransaction = new PostgresStorageInternalTransaction(this.query)
    this.staking = new PostgresStorageStakingTransaction(this.query, this.shardID)
    this.indexer = new PostgresStorageIndexer(this.query)
    this.address = new PostgresStorageAddress(this.query)
    this.contract = new PostgresStorageContract(this.query)
    this.erc20 = new PostgresStorageERC20(this.query)
    this.erc721 = new PostgresStorageERC721(this.query)
    this.erc1155 = new PostgresStorageERC1155(this.query)
    this.signature = new PostgresStorageSignature(this.query)
    this.metrics = new PostgresStorageMetrics(this.query)
    this.oneWalletMetrics = new PostgresStorageOneWalletMetrics(this.query)
    this.utils = new PostgresStorageUtils(this.query)

    this.l = logger(module, `shard${options.shardID}`)
    this.options = options

    this.db = new Pool({
      // todo a hack for kms support
      user: config.store.postgres[this.shardID].user,
      password: config.store.postgres[this.shardID].password,
      host: options.host,
      database: options.database,
      port: options.port,
      max: options.poolSize,
      // https://node-postgres.com/api/pool
      idleTimeoutMillis: 0,
    })
  }

  async start() {
    const p = this.options
    this.l.info(`postgres://${p.user}@${p.host}:${p.port}/${p.database} starting...`)

    this.isStarting = true
    // await this.migrate()
    this.isStarted = true
    this.isStarting = false
    this.l.info('Done')

    const {internalTxsDeletePeriod} = config.indexer
    if (config.indexer.isEnabled && [0, 1].includes(this.shardID) && internalTxsDeletePeriod) {
      this.l.info(`Start removing internal transactions task, period: ${internalTxsDeletePeriod}`)
      try {
        await this.removeOldInternalTransactionsTask(internalTxsDeletePeriod)
      } catch (err) {
        this.l.error(`Failed to start removing internal transactions task: ${JSON.stringify(err)}`)
      }
    }
  }

  async migrate() {
    await this.db.query(scheme)
  }

  query: Query = async (sql: string, params: any[] = [], retries = defaultRetries) => {
    // lazy start
    if (!this.isStarted && !this.isStarting) {
      return this.start().then(() => this.query(sql, params, retries))
    }

    if (this.isStarting) {
      return sleep().then(() => this.query(sql, params, retries))
    }

    try {
      return await this.queryWithoutRetry(sql, params)
    } catch (e) {
      const retriesLeft = retries - 1
      if (retriesLeft > 0) {
        await sleep(200)
        return this.query(sql, params, retriesLeft)
      }
      this.l.warn(`Query failed in ${defaultRetries} attempts`, {
        sql,
        params,
        error: e.message || e,
      })
      throw new Error(e)
    }
  }

  private async queryWithoutRetry(sql: string, params: any[] = []) {
    const time = logTime()

    try {
      const {rows} = await this.db.query(sql, params)
      const timePassed = time()
      // l.debug(`Query completed in ${timePassed} ${sql}`, params)

      /*
      if (timePassed.val > 10000) {
        l.debug(`Query took ${timePassed}`, { sql, params })
      }
      */

      return rows
    } catch (e) {
      this.l.debug(e.message || e, {sql, params})
      throw new Error(e)
    }
  }

  // approximate count
  getCount = async (table: CountableEntities) => {
    const [
      {reltuples: count},
    ] = await this.query(`select reltuples::bigint from pg_catalog.pg_class where relname = $1`, [
      mapNamingReverse[table] || table,
    ])

    return {count}
  }

  removeOldInternalTransactionsTask = async (period: number) => {
    const lastBlockNumber = await this.block.getLatestBlockNumber()
    const toBlock = lastBlockNumber - blockNumber7DayOld
    this.l.info(`Removing internal transactions where block number < ${toBlock}`)

    await this.internalTransaction.removeInternalTxs(lastBlockNumber)
    setTimeout(this.removeOldInternalTransactionsTask, period)
  }

  async stop() {
    await this.db.end()
  }
}
