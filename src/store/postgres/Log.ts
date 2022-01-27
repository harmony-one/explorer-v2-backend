import {IStorageLog} from 'src/store/interface'
import {BlockHash, BlockNumber, Log, LogDetailed} from 'src/types/blockchain'

import {Query} from 'src/store/postgres/types'
import {
  EthGetLogParams,
  Filter,
  InternalTransactionQueryField,
  TransactionQueryValue,
} from 'src/types'
import {buildSQLQuery} from 'src/store/postgres/filters'
import {
  fromSnakeToCamelResponse,
  mapLogToEthLog,
  queryParamsConvert,
} from 'src/store/postgres/queryMapper'

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
        order by l.block_number desc
        offset ${offset} limit ${limit};
    `,
      [value]
    )
    return res.map(fromSnakeToCamelResponse)
  }

  ethGetLogs = async (params: EthGetLogParams) => {
    const {fromBlock, toBlock, address, topics, blockhash} = params
    const whereClause = []

    if (blockhash) {
      whereClause.push('block_number = :blockhash')
    } else {
      whereClause.push('block_number >= :fromBlockInteger and block_number <= :toBlockInteger')
    }

    if (address) {
      if (Array.isArray(address)) {
        whereClause.push('address = any (:address)')
      } else {
        whereClause.push('address = :address')
      }
    }

    if (topics) {
      whereClause.push('topics @> :topics')
    }

    const queryParams = {
      fromBlockInteger: fromBlock ? parseInt(fromBlock, 16) : undefined,
      toBlockInteger: toBlock ? parseInt(toBlock, 16) : undefined,
      address,
      topics: topics ? `{${topics?.join(',')}}` : undefined, // convert topics array to SQL array
      blockhash,
    }

    const filteredParams = Object.entries(queryParams).reduce((acc, [key, value]) => {
      if (value !== undefined) acc[key] = value
      return acc
    }, {} as any)

    const preparedQuery = queryParamsConvert(
      `
        select * from logs
        where ${whereClause.length > 0 ? whereClause.join(' and ') : ''}
        order by block_number desc, log_index asc
    `,
      filteredParams
    )

    const res = await this.query(preparedQuery.text, preparedQuery.values)

    return res.map(fromSnakeToCamelResponse).map(mapLogToEthLog)
  }
}
