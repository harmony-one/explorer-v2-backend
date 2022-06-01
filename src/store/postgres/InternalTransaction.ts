import {IStorageInternalTransaction} from 'src/store/interface'
import {
  TransactionQueryValue,
  InternalTransactionQueryField,
  Filter,
  InternalTransaction,
} from 'src/types'

import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse, generateQuery} from 'src/store/postgres/queryMapper'
import {buildSQLQuery} from 'src/store/postgres/filters'
import {Knex} from 'knex'

export class PostgresStorageInternalTransaction implements IStorageInternalTransaction {
  query: Query
  knex: Knex

  constructor(query: Query, knex: Knex) {
    this.query = query
    this.knex = knex
  }

  addInternalTransaction = async (tx: InternalTransaction) => {
    const newTx = {
      ...tx,
      deployedBytecode: undefined,
      blockHash: undefined,
      value: BigInt(tx.value).toString(),
      gas: BigInt(tx.gas).toString(),
      gasUsed: BigInt(tx.gasUsed).toString(),
    }

    const {query, params} = generateQuery(newTx)
    return await this.query(
      `insert into internal_transactions ${query} on conflict (transaction_hash, index) do nothing;`,
      params
    )
  }

  addBatchInternalTransactions = (txs: InternalTransaction[], chunkSize = 1000) => {
    const rows = txs.map((tx) => {
      return {
        index: tx.index,
        block_number: tx.blockNumber,
        from: tx.from,
        to: tx.to,
        gas: BigInt(tx.gas).toString(),
        gas_used: BigInt(tx.gasUsed).toString(),
        input: tx.input,
        output: tx.output,
        type: tx.type,
        value: BigInt(tx.value).toString(),
        transaction_hash: tx.transactionHash,
        time: tx.time,
        error: tx.error,
      }
    })
    return this.knex.batchInsert('internal_transactions', rows, chunkSize)
  }

  getInternalTransactionsByField = async (
    field: InternalTransactionQueryField,
    value: TransactionQueryValue
  ): Promise<InternalTransaction[]> => {
    const res = await this.query(`select * from internal_transactions where ${field}=$1;`, [value])
    return res.map(fromSnakeToCamelResponse)
  }

  getInternalTransactions = async (filter: Filter): Promise<InternalTransaction[]> => {
    const q = buildSQLQuery(filter)
    const res = await this.query(`select * from internal_transactions ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }
}

// todo search by input sig
