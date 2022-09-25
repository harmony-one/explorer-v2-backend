import {IStorageMetrics} from 'src/store/interface'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse} from 'src/store/postgres/queryMapper'

enum MetricsType {
  walletsCount = 'wallets_count',
  transactionsCount = 'transactions_count',
  averageFee = 'average_fee',
}

export class PostgresStorageMetrics implements IStorageMetrics {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  getTransactionCount = async (limit = 14, direction = 'desc'): Promise<any[]> => {
    const rows = await this.query(
      `select date as timestamp, "value" as count from metrics
             where type = 'transactions_count'
             order by id ${direction} limit $1;`,
      [limit]
    )
    return rows.reverse()
  }

  // last 14 days of funded addresses
  getWalletsCount = async (limit: number): Promise<any[]> => {
    const rows = await this.query(
      `select date, "value" as count from metrics where type = 'wallets_count' order by id desc limit $1;`,
      [limit]
    )
    return rows.map((o: any) => ({date: o.date, count: o.count})).reverse()
  }

  updateTransactionsCount = async (days: number) => {
    const rows = await this.query(
      `select date_trunc('day', "timestamp") as date, count(1) from "transactions"
             where "transactions"."timestamp" >= date_trunc('day', now() - interval '14 day')
             and "transactions"."timestamp" < date_trunc('day', now() - interval '0 day')
             group by 1
             order by 1 desc
             limit 1000`,
      []
    )

    if (rows.length > 0) {
      await this.insertStats(MetricsType.transactionsCount, rows)
    }
    return rows
  }

  updateWalletsCount = async (offsetFrom = 14, offsetTo = 0) => {
    const limit = Math.abs(offsetFrom - offsetTo)

    // Select block number to faster filter transactions
    let blockRows = await this.query(
      `
        SELECT "number"
        FROM blocks
        WHERE "timestamp" < date_trunc('day', now() - interval '${offsetFrom} day')
        order by "number" desc
        LIMIT 1`,
      []
    )
    if (blockRows.length === 0) {
      // Slower query - in case if blocks table doesn't contain data for older than 2 weeks
      blockRows = await this.query(
        `SELECT "number" FROM blocks WHERE "timestamp" > date_trunc('day', now() - interval '${offsetFrom} day')
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
          WHERE date < date_trunc('day', now() - interval '${offsetTo} day')
          GROUP BY date
          )
          SELECT date, active_wallets as count FROM daily
          ORDER BY date DESC
          limit $1`,
      [limit, blockNumber]
    )

    if (rows.length > 0) {
      await this.insertStats(MetricsType.walletsCount, rows)
    }
    return rows
  }

  private insertStats = (metricsType: MetricsType, rows: Array<{date: string; count: string}>) => {
    const preparedRows = rows
      .reverse()
      .map((row: any) => [row.date, row.count])
      .flat()

    // ($1, $2, $3), ($4, $5, $6), ...
    const multipleValues = Array(rows.length)
      .fill(null)
      .map((_, i) => `('${metricsType}', $${i * 2 + 1}, $${i * 2 + 2})`)
      .join(',')

    return this.query(
      `insert into metrics (type, date, value)
            values ${multipleValues}
            on conflict (type, date, value) do nothing;`,
      [...preparedRows]
    )
  }
}
