import {IStorageLog} from 'src/store/interface'
import {BlockHash, BlockNumber, Log, LogDetailed} from 'src/types/blockchain'

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
  ): Promise<Log[]> => {
    const res = await this.query(`select * from logs where ${field}=$1;`, [value])
    return res.map(fromSnakeToCamelResponse)
  }

  getDetailedLogsByField = async (
    field: InternalTransactionQueryField,
    value: TransactionQueryValue,
    limit = 10,
    offset = 0
  ): Promise<LogDetailed[]> => {
    const res = await this.query(
      `
        select l.*, t.input, t.timestamp
        from logs l
        left join transactions t on t.hash = l.transaction_hash 
        where ${field}=$1
        offset ${offset} limit ${limit};
    `,
      [value]
    )
    return res.map(fromSnakeToCamelResponse)
  }
}
