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
    const subQueryLimit = 10000000

    let txs = []

    if (type === 'erc20' || type === 'erc721') {
      if (type === 'erc20') {
        txs = await this.query(
          `
            select ce.*, t.timestamp, t.input
            from (
                 (select * from contract_events ce where ce.from = $1 and ce.transaction_type = $2 order by block_number desc limit $5)
                 union all
                 (select * from contract_events ce where ce.to = $1 and ce.transaction_type = $2 order by block_number desc limit $5)
            ) ce
            join transactions t on t.hash = ce.transaction_hash
            order by ce.block_number desc
            offset $3
            limit $4`,
          [address, type, offset, limit, subQueryLimit]
        )
      } else {
        // Include both erc721 & erc1155
        txs = await this.query(
          `
            select ce.*, t.timestamp
            from (
                 (select * from contract_events ce
                    where ce.from = $1
                    and (transaction_type = 'erc721' or transaction_type = 'erc1155')
                    order by block_number desc limit $4
                 )
                 union all
                 (select * from contract_events ce
                    where ce.to = $1
                    and (transaction_type = 'erc721' or transaction_type = 'erc1155')
                    order by block_number desc limit $4
                 )
            ) ce
            join transactions t on t.hash = ce.transaction_hash
            order by ce.block_number desc
            offset $2
            limit $3`,
          [address, offset, limit, subQueryLimit]
        )
      }

      // for erc20 and erc721 we add logs to payload
      txs = await Promise.all(
        txs.map(fromSnakeToCamelResponse).map(async (tx: any) => {
          const results = await this.query('select * from logs where transaction_hash=$1', [
            tx.transactionHash,
          ])
          tx.logs = results.map(fromSnakeToCamelResponse)
          return tx
        })
      )
    } else if (type === 'internal_transaction') {
      const filterQuery = buildSQLQuery({filters: filter.filters})
      txs = await this.query(
        `
      select it.*, t.input, t.timestamp from (
        select * from (
        (select * from internal_transactions it ${filterQuery} and it.from = $1 order by block_number desc limit $4)
        union all 
        (select * from internal_transactions it ${filterQuery} and it.to = $1 order by block_number desc limit $4)
        ) it
        ${filterQuery}
      ) it
      left join transactions t on t.hash  = it.transaction_hash
      offset $2
      limit $3
    `,
        [address, offset, limit, subQueryLimit]
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
            (select * from ${txsTable} t where t.from = $1 order by block_number desc limit $2)
            union all
            (select * from ${txsTable} t where t.to = $1 order by block_number desc limit $2)
        ) t
        ${filterQuery}
      `,
        [address, subQueryLimit]
      )
    }

    return txs
      .map(fromSnakeToCamelResponse)
      .sort((a: InternalTransaction, b: InternalTransaction) => b.blockNumber - a.blockNumber)
  }

  getRelatedTransactionsCountByType = async (
    address: Address,
    type: AddressTransactionType,
    filter: Filter
  ): Promise<number> => {
    const subQueryLimit = 100000 // Count estimate max value

    if (type === 'erc20') {
      const [{count}] = await this.query(
        `
          select count(*) from
          (
          select * from (
               (select * from contract_events ce
                    where ce.from = $1 and ce.transaction_type = $2
               )
               union all
               (select * from contract_events ce
                    where ce.to = $1 and ce.transaction_type = $2
               )
          ) ce
          limit $3
          ) ce2
          join transactions t on t.hash = ce2.transaction_hash
            `,
        [address, type, subQueryLimit]
      )
      return count
    } else if (type === 'erc721') {
      const [{count}] = await this.query(
        `
          select count(*) from
          (
            select * from (
                 (select * from contract_events ce
                    where ce.from = $1
                    and (transaction_type = 'erc721' or transaction_type = 'erc1155')
                    order by block_number desc limit $2
                 )
                 union all
                 (select * from contract_events ce
                    where ce.to = $1
                    and (transaction_type = 'erc721' or transaction_type = 'erc1155')
                    order by block_number desc limit $2
                 )
            ) ce
            limit $2
          ) ce2
          join transactions t on t.hash = ce2.transaction_hash
            `,
        [address, subQueryLimit]
      )
      return count
    } else if (type === 'internal_transaction') {
      const filterQuery = buildSQLQuery({filters: filter.filters})
      const [{count}] = await this.query(
        ` 
      select count(t.*) from (
        select * from (
          (select * from internal_transactions it ${filterQuery} and it.from = $1)
          union all 
          (select * from internal_transactions it ${filterQuery} and it.to = $1)
        ) it
        ${filterQuery}
        limit $2
      ) it
      left join transactions t on t.hash  = it.transaction_hash
    `,
        [address, subQueryLimit]
      )
      return count
    } else {
      let tableName = 'transactions'
      if (type === 'staking_transaction') {
        tableName = 'staking_transactions'
      }
      const [{count}] = await this.query(
        `
      select count(*)
        from (
            (select * from ${tableName} t where t.from = $1 limit $2)
            union all
            (select * from ${tableName} t where t.to = $1 limit $2)
        ) t
    `,
        [address, subQueryLimit]
      )
      return count
    }
  }
}
