import {IStorageMetrics} from 'src/store/interface'
import {Query} from 'src/store/postgres/types'
import {MetricsType} from 'src/types'

export class PostgresStorageMetrics implements IStorageMetrics {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  getTransactionCount = async (offset = 0, limit = 14): Promise<any[]> => {
    const rows = await this.query(
      `select date as timestamp, "value" as count from metrics_daily
             where type = 'transactions_count'
             order by date desc
             offset $1
             limit $2;`,
      [offset, limit]
    )
    return rows.reverse()
  }

  getWalletsCount = async (limit = 14): Promise<any[]> => {
    const rows = await this.query(
      `select date, "value" as count from metrics_daily where type = 'wallets_count' order by date desc limit $1;`,
      [limit]
    )
    return rows.map((o: any) => ({date: o.date, count: o.count})).reverse()
  }

  // TODO: remove getTransactionCount and getWalletsCount methods
  getMetricsByType = async (type: MetricsType, offset = 0, limit = 14) => {
    const rows = await this.query(
      `select date, "value" from metrics_daily
             where type = '${type}'
             order by date desc
             offset $1
             limit $2;`,
      [offset, limit]
    )
    return rows
  }

  updateTransactionsCount = async (offsetFrom = 14, offsetTo = 0) => {
    const rows = await this.query(
      `select date_trunc('day', "timestamp") as date, count(1) as value from "transactions"
             where "transactions"."timestamp" >= date_trunc('day', now() - interval '${
               offsetFrom + 1
             } day')
             and "transactions"."timestamp" < date_trunc('day', now() - interval '${offsetTo} day')
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
    const rows = await this.query(
      `WITH base as (
              (SELECT date_trunc('day', "timestamp") as date, "from" as wallet_address
              FROM "transactions"
              WHERE "transactions"."timestamp" >= date_trunc('day', now() - interval '${
                offsetFrom + 1
              } day'))
              UNION
              (SELECT date_trunc('day', "timestamp") as date, "to" as wallet_address
              FROM "transactions"
              WHERE "transactions"."timestamp" >= date_trunc('day', now() - interval '${
                offsetFrom + 1
              } day'))
          ),
          daily as (
          select date, count(distinct(wallet_address)) as active_wallets
          from base
          WHERE date < date_trunc('day', now() - interval '${offsetTo} day')
          GROUP BY date
          )
          SELECT date, active_wallets as value FROM daily
          ORDER BY date DESC
          limit $1`,
      [limit]
    )

    if (rows.length > 0) {
      await this.insertStats(MetricsType.walletsCount, rows)
    }
    return rows
  }

  updateAverageFee = async (offsetFrom = 14, offsetTo = 0) => {
    const rows = await this.query(
      `select date_trunc('day', "timestamp") as date, round(avg(gas * gas_price / power(10, 18))::numeric, 8) as value
             from "transactions"
             where "transactions"."timestamp" >= date_trunc('day', now() - interval '${
               offsetFrom + 1
             } day')
             and "transactions"."timestamp" < date_trunc('day', now() - interval '${offsetTo} day')
             group by 1
             order by 1 desc
             limit 1000`,
      []
    )

    if (rows.length > 0) {
      await this.insertStats(MetricsType.averageFee, rows)
    }
    return rows
  }

  private updateErcContracts = async (tableName: 'erc20' | 'erc721' | 'erc1155') => {
    await this.query(
      `update ${tableName}
      set transaction_count = t1.count
      from (
      select e.address, count(1) from ${tableName} e 
      join transactions t on t.to = e.address
      group by e.address
      order by count(1) desc
      ) as t1
      where t1.address = ${tableName}.address`,
      []
    )
  }

  updateTopContracts = async () => {
    await this.updateErcContracts('erc20')
    await this.updateErcContracts('erc721')
    await this.updateErcContracts('erc1155')
  }

  private insertStats = (metricsType: MetricsType, rows: Array<{date: string; value: string}>) => {
    const preparedRows = rows
      .reverse()
      .map((row: any) => [row.date, row.value])
      .flat()

    // ($1, $2, $3), ($4, $5, $6), ...
    const multipleValues = Array(rows.length)
      .fill(null)
      .map((_, i) => `('${metricsType}', $${i * 2 + 1}, $${i * 2 + 2})`)
      .join(',')

    return this.query(
      `insert into metrics_daily (type, date, value)
            values ${multipleValues}
            on conflict (type, date, value) do nothing;`,
      [...preparedRows]
    )
  }
}
