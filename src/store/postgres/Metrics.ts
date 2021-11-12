import {IStorageMetrics} from 'src/store/interface'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse} from 'src/store/postgres/queryMapper'

export class PostgresStorageMetrics implements IStorageMetrics {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  // last 14 days txs count
  getTransactionCountLast14Days = async (): Promise<any[]> => {
    const res = await this.query(
      `select date_trunc('day', "timestamp") as timestamp, count(1) from "transactions"
            where "transactions"."timestamp" >= date_trunc('day', now() - interval '14 day') group by 1 order by 1 limit 1000;`,
      []
    )

    return res.map(fromSnakeToCamelResponse)
  }

  addWalletsCountLast14Days = async () => {
    const currentDateString = new Date().toISOString().split('T')[0]

    const lastRecord = await this.query(
      `select date_string from wallets_count order by id desc limit 1;`,
      []
    )

    if (lastRecord.length && currentDateString === lastRecord[0].date_string) {
      return
    }

    const [{count}] = await this.query(
      `select count(distinct("to")) from internal_transactions where value>0;`,
      []
    )
    await this.query(
      `insert into wallets_count (count, date_string) values($1, $2) on conflict (date_string) do nothing;`,
      [count, currentDateString]
    )
  }

  // last 14 days of funded addresses
  getWalletsCountLast14Days = async (): Promise<any[]> => {
    const getRecords = async () => {
      const res = await this.query(
        `select date_string, "count" from wallets_count order by id desc limit 14;`,
        []
      )
      return res.map((o: any) => ({date: o.date_string, count: o.count})).reverse()
    }

    return await getRecords()
  }
}
