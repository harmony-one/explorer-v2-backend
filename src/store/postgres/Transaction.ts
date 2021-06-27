import {IStorageTransaction} from 'src/store/interface'
import {
  TransactionQueryField,
  TransactionQueryValue,
  RPCTransactionHarmony,
  Transaction,
  Filter,
} from 'src/types'

import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse, generateQuery} from 'src/store/postgres/queryMapper'
import {buildSQLQuery} from 'src/store/postgres/filters'

export class PostgresStorageTransaction implements IStorageTransaction {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addTransactions = async (txs: RPCTransactionHarmony[]) => {
    return Promise.all(txs.map((t) => this.addTransaction(t)))
  }

  addTransaction = async (tx: RPCTransactionHarmony) => {
    const newTx = {
      ...tx,
      hash: tx.ethHash,
      hash_harmony: tx.hash,
      ethHash: undefined,
      blockNumber: BigInt(tx.blockNumber).toString(),
      value: BigInt(tx.value).toString(),
      gas: BigInt(tx.gas).toString(),
      gasPrice: BigInt(tx.gasPrice).toString(),
    }

    const {query, params} = generateQuery(newTx)
    return await this.query(
      `insert into transactions ${query} on conflict (hash) do nothing;`,
      params
    )
  }

  getTransactionsByField = async (
    field: TransactionQueryField,
    value: TransactionQueryValue
  ): Promise<Transaction[]> => {
    const res = await this.query(`select * from transactions where ${field}=$1;`, [value])
    return res.map(fromSnakeToCamelResponse)
  }

  getTransactions = async (filter: Filter): Promise<Transaction[]> => {
    const q = buildSQLQuery(filter)
    const res = await this.query(`select * from transactions ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }
}
