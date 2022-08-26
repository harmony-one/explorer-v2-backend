import {IStorageMetrics} from 'src/store/interface'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse} from 'src/store/postgres/queryMapper'

export class PostgresStorageMetrics implements IStorageMetrics {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  getTransactionCount = async (numberOfDays = 14): Promise<any[]> => {
    const res = await this.query(
      `select date_trunc('day', "timestamp") as timestamp, count(1) from "transactions"
            where "transactions"."timestamp" < date_trunc('day', CURRENT_DATE)
            group by 1 order by 1 desc limit $1`,
      [numberOfDays]
    )

    return res.map(fromSnakeToCamelResponse).reverse()
  }

  updateWalletsStats = async (numberOfDays = 14) => {
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
            SELECT date, active_wallets FROM daily
            ORDER BY date DESC
            limit $1`,
      [numberOfDays]
    )
    const preparedRows = rows
      .reverse()
      .map((row: any) => [row.active_wallets, row.date])
      .flat()

    const multipleValues = Array(numberOfDays)
      .fill(null)
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`) // ($1, $2), ($3, $4), ...
      .join(',')

    await this.query(
      `insert into wallets_count (count, date_string)
            values ${multipleValues} on conflict (date_string) do nothing;`,
      [...preparedRows]
    )
  }

  // last 14 days of funded addresses
  getWalletsCount = async (numberOfDays = 14): Promise<any[]> => {
    const getRecords = async () => {
      const res = await this.query(
        `select date_string, "count" from wallets_count order by id desc limit $1;`,
        [numberOfDays]
      )
      return res.map((o: any) => ({date: o.date_string, count: o.count})).reverse()
    }

    return await getRecords()
  }
}
