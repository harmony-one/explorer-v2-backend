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

export class PostgresStorageInternalTransaction implements IStorageInternalTransaction {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  // remove old transactions every day
  removeInternalTransactionsOlder7Days = async (toBlockNumber: number) => {
    const res = await this.query(`delete from internal_transactions where block_number < $1`, [
      toBlockNumber,
    ])
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
