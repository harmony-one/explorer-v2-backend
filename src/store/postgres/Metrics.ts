import {IStorageMetrics} from 'src/store/interface'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse} from 'src/store/postgres/queryMapper'

enum StatsTable {
  wallets = 'wallets_count',
  transactions = 'transactions_count',
}

export class PostgresStorageMetrics implements IStorageMetrics {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  getTransactionCount = async (numberOfDays: number): Promise<any[]> => {
    const rows = await this.query(
      `select date_string as timestamp, "count" from transactions_count order by id desc limit $1;`,
      [numberOfDays]
    )
    return rows.reverse()
  }

  // last 14 days of funded addresses
  getWalletsCount = async (numberOfDays: number): Promise<any[]> => {
    const rows = await this.query(
      `select date_string, "count" from wallets_count order by id desc limit $1;`,
      [numberOfDays]
    )
    return rows.map((o: any) => ({date: o.date_string, count: o.count})).reverse()
  }

  updateTransactionsCount = async (numberOfDays: number) => {
    const rows = await this.query(
      `select date_trunc('day', "timestamp") as date, count(1) from "transactions"
             where "transactions"."timestamp" >= date_trunc('day', now() - interval '14 day')
             and "transactions"."timestamp" < date_trunc('day', CURRENT_DATE)
             group by 1
             order by 1 desc
             limit 1000`,
      []
    )
    await this.insertStats(StatsTable.transactions, rows)
  }

  updateWalletsCount = async (numberOfDays: number) => {
    // Select block number to faster filter transactions
    let blockRows = await this.query(
      `
        SELECT "number"
        FROM blocks
        WHERE "timestamp" < date_trunc('day', now() - interval '14 day')
        order by "number" desc
        LIMIT 1`,
      []
    )
    if (blockRows.length === 0) {
      // Slower query - in case if blocks table doesn't contain data for older than 2 weeks
      blockRows = await this.query(
        `SELECT "number" FROM blocks WHERE "timestamp" > date_trunc('day', now() - interval '14 day')
        ORDER BY "number" ASC LIMIT 1`,
        []
      )
    }
    const [{number: blockNumber}] = blockRows
    const rows = await this.query(
      `WITH base as (
              (SELECT date_trunc('day', "timestamp") as date, "from" as wallet_address
              FROM "transactions"
              WHERE block_number >= $2)
              UNION
              (SELECT date_trunc('day', "timestamp") as date, "to" as wallet_address
              FROM "transactions"
              WHERE block_number >= $2)
          ),
          daily as (
          select date, count(distinct(wallet_address)) as active_wallets
          from base
          WHERE date < date_trunc('day', CURRENT_DATE)
          GROUP BY date
          )
          SELECT date, active_wallets as count FROM daily
          ORDER BY date DESC
          limit $1`,
      [numberOfDays, blockNumber]
    )

    await this.insertStats(StatsTable.wallets, rows)
  }

  private insertStats = (tableName: StatsTable, rows: Array<{date: string; count: string}>) => {
    const preparedRows = rows
      .reverse()
      .map((row: any) => [row.count, row.date])
      .flat()

    const multipleValues = Array(rows.length)
      .fill(null)
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`) // ($1, $2), ($3, $4), ...
      .join(',')

    return this.query(
      `insert into ${tableName} (count, date_string)
            values ${multipleValues} on conflict (date_string) do nothing;`,
      [...preparedRows]
    )
  }
}
