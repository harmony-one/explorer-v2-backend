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
            where "transactions"."timestamp" < date_trunc('day', CURRENT_DATE)
            group by 1 order by 1 desc limit $1`,
      [numberOfDays]
    )

    if (rows.length > 0) {
      await this.insertStats(StatsTable.transactions, rows)
    }
  }

  updateWalletsCount = async (numberOfDays: number) => {
    const rows = await this.query(
      `WITH base AS (
            SELECT distinct DATE_TRUNC('DAY', "timestamp") AS date, "from" AS wallet_address FROM transactions
            UNION ALL
            SELECT DISTINCT DATE_TRUNC('DAY', "timestamp") AS date, "to" AS wallet_address FROM transactions
            ),
            daily AS (
            SELECT date, COUNT(DISTINCT wallet_address) AS active_wallets
            FROM base
            WHERE date < date_trunc('day', CURRENT_DATE)
            GROUP BY date
            )
            SELECT date, active_wallets as count FROM daily
            ORDER BY date DESC
            limit $1`,
      [numberOfDays]
    )

    if (rows.length > 0) {
      await this.insertStats(StatsTable.wallets, rows)
    }
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
