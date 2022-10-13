import {IStorageMetrics} from 'src/store/interface'
import {Query} from 'src/store/postgres/types'
import {MetricsDailyType, MetricsTopType} from 'src/types'
import {fromSnakeToCamelResponse} from 'src/store/postgres/queryMapper'

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
  getMetricsByType = async (type: MetricsDailyType, offset = 0, limit = 14) => {
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

  getTopMetricsByType = async (type: MetricsTopType, period = 1, limit = 10) => {
    let rows = []
    rows = await this.query(
      `select * from metrics_top
               where type = $1 and period = $2
               order by rank asc
               limit $3
               `,
      [type, period, limit]
    )
    return rows.map(fromSnakeToCamelResponse)
  }

  updateTransactionsCount = async (offsetFrom = 14, offsetTo = 0) => {
    const rows = await this.query(
      `select to_date("timestamp"::varchar, 'YYYY-MM-DD')::varchar as date, count(1) as value
             from (
              select timestamp from "transactions"
              union all
              select timestamp from "staking_transactions"
             ) t1
             where "timestamp" >= date_trunc('day', now() - interval '${offsetFrom} day')
             and "timestamp" < date_trunc('day', now() - interval '${offsetTo} day')
             group by 1
             order by 1 desc
             limit 1000`,
      []
    )

    if (rows.length > 0) {
      await this.insertStats(MetricsDailyType.transactionsCount, rows)
    }
    return rows
  }

  updateWalletsCount = async (offsetFrom = 14, offsetTo = 0) => {
    const limit = Math.abs(offsetFrom - offsetTo)
    const rows = await this.query(
      `WITH base as (
              SELECT to_date("timestamp"::varchar, 'YYYY-MM-DD')::varchar as date, wallet_address
              FROM (
                  select timestamp, "from" as wallet_address from "transactions"
                  union all
                  select timestamp, "to" as wallet_address from "transactions"
                  union all
                  select timestamp, "from" as wallet_address from "staking_transactions"
                  union all
                  select timestamp, "to" as wallet_address from "staking_transactions"
                 ) t1
              WHERE "timestamp" >= date_trunc('day', now() - interval '${offsetFrom} day')
              AND "timestamp" < date_trunc('day', now() - interval '${offsetTo} day')
          ),
          daily as (
          select date, count(distinct(wallet_address)) as active_wallets
          from base
          GROUP BY date
          )
          SELECT date, active_wallets as value FROM daily
          ORDER BY date DESC
          limit $1`,
      [limit]
    )

    if (rows.length > 0) {
      await this.insertStats(MetricsDailyType.walletsCount, rows)
    }
    return rows
  }

  updateAverageFee = async (offsetFrom = 14, offsetTo = 0) => {
    const rows = await this.query(
      `select to_date("timestamp"::varchar, 'YYYY-MM-DD')::varchar as date,
             round(avg(gas * gas_price / power(10, 18))::numeric, 8) as value
             from (
              select timestamp, gas, gas_price from "transactions"
              union all
              select timestamp, gas, gas_price from "staking_transactions"
             ) t1
             where "timestamp" >= date_trunc('day', now() - interval '${offsetFrom} day')
             and "timestamp" < date_trunc('day', now() - interval '${offsetTo} day')
             group by 1
             order by 1 desc
             limit 1000`,
      []
    )

    if (rows.length > 0) {
      await this.insertStats(MetricsDailyType.averageFee, rows)
    }
    return rows
  }

  updateBlockSize = async (offsetFrom = 14, offsetTo = 0) => {
    const rows = await this.query(
      `select to_date("timestamp"::varchar, 'YYYY-MM-DD')::varchar as date,
             round(avg(size)) as value from "blocks"
             where "timestamp" >= date_trunc('day', now() - interval '${offsetFrom + 1} day')
             and "timestamp" < date_trunc('day', now() - interval '${offsetTo} day')
             group by 1
             order by 1 desc
             limit 1000`,
      []
    )

    if (rows.length > 0) {
      await this.insertStats(MetricsDailyType.blockSize, rows)
    }
    return rows
  }

  updateTopOne = async (
    type: MetricsTopType.topOneSender | MetricsTopType.topOneReceiver,
    offsetFrom = 1,
    offsetTo = 0,
    limit = 30
  ) => {
    const columnName = type === MetricsTopType.topOneSender ? 'from' : 'to' // Sender or receiver
    const period = Math.abs(offsetFrom - offsetTo)

    // Don't count transfers to yourself
    const rows = await this.query(
      `
              with base as (
               select "${columnName}" as address, value from "transactions"
               where "timestamp" >= date_trunc('day', now() - interval '${offsetFrom} day')
               and "timestamp" < date_trunc('day', now() - interval '${offsetTo} day')
               and "from" != "to"
              ),
              base_total as (
                select sum(value) as total from base
              )
              select address,
              total, sum(value) as value,
              round((sum(value) / total) * 100, 4) as share,
              rank () over (order by sum(value) desc, address desc) as rank
              from base
              cross join base_total
              group by 1, 2
              order by value desc
              limit $1`,
      [limit]
    )
    if (rows.length > 0) {
      await this.insertTopStats(type, period, rows)
    }
    return rows
  }

  updateTopTxsCount = async (
    type: MetricsTopType.topTxsCountSent | MetricsTopType.topTxsCountReceived,
    period: number,
    limit = 100
  ) => {
    const columnName = type === MetricsTopType.topTxsCountSent ? 'from' : 'to' // Sender or receiver

    // Don't count transfers to yourself
    const rows = await this.query(
      `
              with base as (
               select "${columnName}" as address, value from "transactions"
               where "timestamp" >= date_trunc('day', now() - interval '${period} day')
               and "timestamp" < date_trunc('day', now() - interval '0 day')
               and "from" != "to"
              ),
              base_total as (
                select count(*)::decimal as total from base
              )
              select address,
              total,
              count(*) as value,
              round((count(*) /  total * 100), 4) as share,
              RANK () OVER (ORDER BY count(*) desc, address desc) as rank
              from base
              cross join base_total
              group by 1, 2
              order by value desc
              limit $1`,
      [limit]
    )
    if (rows.length > 0) {
      await this.insertTopStats(type, period, rows)
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

  private insertStats = (type: MetricsDailyType, rows: Array<{date: string; value: string}>) => {
    const preparedRows = rows
      .reverse()
      .map((row: any) => [row.date, row.value])
      .flat()

    // ($1, $2, $3), ($4, $5, $6), ...
    const multipleValues = Array(rows.length)
      .fill(null)
      .map((_, i) => `('${type}', $${i * 2 + 1}, $${i * 2 + 2})`)
      .join(',')

    return this.query(
      `insert into metrics_daily (type, date, value)
            values ${multipleValues}
            on conflict (type, date) do nothing;`,
      [...preparedRows]
    )
  }

  private insertTopStats = async (
    type: MetricsTopType,
    period: number,
    rows: Array<{address: string; value: string; share: string}>
  ) => {
    const preparedRows = rows.map((r: any) => [r.address, r.value, r.share, r.rank]).flat()

    // ($1, $2, $3, $4), ($5, $6, $7, $8), ...
    const multipleValues = Array(rows.length)
      .fill(null)
      .map(
        (_, i) =>
          `('${type}', ${period}, $${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
      )
      .join(',')

    try {
      await this.query('BEGIN', [])
      await this.query(`delete from metrics_top where type = '${type}' and period = ${period}`, [])
      await this.query(
        `insert into metrics_top (type, period, address, value, share, rank)
            values ${multipleValues}`,
        [...preparedRows]
      )
      await this.query('COMMIT', [])
      return rows
    } catch (e) {
      await this.query('ROLLBACK', [])
      return []
    }
  }
}
