import {IStorageLog} from 'src/store/interface'
import {BlockHash, BlockNumber, InternalTransaction, Log, ShardID} from 'src/types/blockchain'

import {Query} from 'src/store/postgres/types'
import {Filter, InternalTransactionQueryField, TransactionQueryValue} from 'src/types'
import {buildSQLQuery} from 'src/store/postgres/filters'
import {fromSnakeToCamelResponse} from 'src/store/postgres/queryMapper'

export class PostgresStorageLog implements IStorageLog {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addLog = async (log: Log): Promise<any> => {
    return await this.query(
      `insert into logs
       (
        address,
        topics,
        data,
        block_number,
        transaction_hash,
        transaction_index,
        block_hash,
        log_index,
        removed
       ) values
       ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (transaction_hash, log_index) do nothing;`,
      [
        log.address,
        log.topics,
        log.data,
        parseInt(log.blockNumber, 16),
        log.transactionHash,
        parseInt(log.transactionIndex, 16),
        log.blockHash,
        parseInt(log.logIndex, 16),
        log.removed,
      ]
    )
  }

  addLogs = (logs: Log[]): Promise<any> => {
    let values = ''
    const params = []

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]
      const logParams = [
        log.address,
        log.topics,
        log.data,
        parseInt(log.blockNumber, 16),
        log.transactionHash,
        parseInt(log.transactionIndex, 16),
        log.blockHash,
        parseInt(log.logIndex, 16),
        log.removed,
      ]
      const valuesList = Array(logParams.length)
        .fill(null)
        .map((_, paramIndex) => `$${params.length + paramIndex + 1}`)
        .join(',')
      if (i > 0) {
        values += ', '
      }
      values += `(${valuesList})`
      params.push(...logParams)
    }

    return this.query(
      `insert into logs
       (
        address,
        topics,
        data,
        block_number,
        transaction_hash,
        transaction_index,
        block_hash,
        log_index,
        removed
       ) values
       ${values} on conflict (transaction_hash, log_index) do nothing;`,
      params
    )
  }

  getLogsByTransactionHash = async (TransactionHash: string): Promise<Log[] | null> => {
    const res = await this.query(`select * from logs where transaction_hash=$1;`, [TransactionHash])

    return res as Log[]
  }
  getLogsByBlockNumber = async (num: BlockNumber): Promise<Log[] | null> => {
    const res = await this.query(`select * from logs where block_number=$1;`, [num])

    return res as Log[]
  }
  getLogsByBlockHash = async (hash: BlockHash): Promise<Log[] | null> => {
    const res = await this.query(`select * from logs where block_hash=$1;`, [hash])

    return res as Log[]
  }

  getLogs = async (filter: Filter): Promise<Log[]> => {
    const q = buildSQLQuery(filter)
    const res = await this.query(`select * from logs ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getLogsByField = async (
    field: InternalTransactionQueryField,
    value: TransactionQueryValue
  ): Promise<InternalTransaction[]> => {
    const res = await this.query(`select * from logs where ${field}=$1;`, [value])
    return res.map(fromSnakeToCamelResponse)
  }
}
