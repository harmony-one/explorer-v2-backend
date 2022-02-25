import {IStorageAddress} from 'src/store/interface'
import {
  Address2Transaction,
  Block,
  Filter,
  AddressTransactionType,
  Address,
  InternalTransaction,
} from 'src/types'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse, generateQuery} from 'src/store/postgres/queryMapper'
import {buildSQLQuery} from 'src/store/postgres/filters'

export class PostgresStorageAddress implements IStorageAddress {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addAddress2Transaction = async (entry: Address2Transaction) => {
    if (!entry.transactionHash) {
      return
    }

    // const {query, params} = generateQuery(newEntry)
    // store latest 100 relations
    return await this.query(
      `insert into address2transaction_fifo (transaction_hashes,address,transaction_type) values(array[$1],$2,$3)
      on conflict (address, transaction_type) do update
      set transaction_hashes = (array_cat(EXCLUDED.transaction_hashes, address2transaction_fifo.transaction_hashes))[:100];`,
      [entry.transactionHash, entry.address, entry.transactionType]
    )
  }

  getRelatedTransactionsByType = async (
    address: Address,
    type: AddressTransactionType,
    filter: Filter
  ): Promise<Address2Transaction[]> => {
    const {offset = 0, limit = 10} = filter

    let txs = []

    if (type === 'erc20' || type === 'erc721') {
      txs = await this.query(
        `
            select t.*
            from (
                 (select * from contract_events ce where ce.from = $1 and ce.transaction_type = $2 order by block_number desc)
                 union all
                 (select * from contract_events ce where ce.to = $1 and ce.transaction_type = $2 order by block_number desc)
            ) ce
            join transactions t on t.hash = ce.transaction_hash
            order by ce.block_number desc
            offset ${offset}
            limit ${limit}`,
        [address, type]
      )

      // for erc20 and erc721 we add logs to payload
      txs = await Promise.all(
        txs.map(fromSnakeToCamelResponse).map(async (tx: any) => {
          tx.logs = await this.query('select * from logs where transaction_hash=$1', [tx.hash])
          return tx
        })
      )
    } else if (type === 'internal_transaction') {
      txs = await this.query(
        `
        select it.*, t.timestamp, t.input
        from (
            (select * from internal_transactions t where t.from = $1 order by block_number desc)
            union all
            (select * from internal_transactions t where t.to = $1 order by block_number desc)
        ) it
        join transactions t on t.hash = it.transaction_hash 
        order by block_number desc, index desc
        offset $2
        limit $3
      `,
        [address, offset, limit]
      )
    } else {
      let txsTable = 'transactions'
      if (type === 'staking_transaction') {
        txsTable = 'staking_transactions'
      }
      const filterQuery = buildSQLQuery(filter)
      txs = await this.query(
        `
        select t.*
        from (
            (select * from ${txsTable} t where t.from = $1 order by block_number desc)
            union all
            (select * from ${txsTable} t where t.to = $1 order by block_number desc)
        ) t
        ${filterQuery}
      `,
        [address]
      )
    }

    return txs
      .map(fromSnakeToCamelResponse)
      .sort((a: InternalTransaction, b: InternalTransaction) => b.blockNumber - a.blockNumber)
  }

  getRelatedTransactionsCountByType = async (
    address: Address,
    type: AddressTransactionType
  ): Promise<number> => {
    if (type === 'erc20' || type === 'erc721') {
      const [{count}] = await this.query(
        `select count(t.*) from contract_events ce 
            join transactions t on t.hash = ce.transaction_hash 
            where ce.transaction_type = $2
            and (ce."from" = $1 or ce."to" = $1)`,
        [address, type]
      )
      return count
    } else {
      let tableName = 'transactions'
      if (type === 'staking_transaction') {
        tableName = 'staking_transactions'
      } else if (type === 'internal_transaction') {
        tableName = 'internal_transactions'
      }
      const [{count}] = await this.query(
        `
      select count(*)
        from (
            (select * from ${tableName} t where t.from = $1)
            union all
            (select * from ${tableName} t where t.to = $1)
        ) t
    `,
        [address]
      )
      return count
    }
  }
}
