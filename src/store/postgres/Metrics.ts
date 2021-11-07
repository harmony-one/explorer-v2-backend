import {IStorageMetrics} from 'src/store/interface'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse} from 'src/store/postgres/queryMapper'

let isAddingRecord = false

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

  // last 14 days of funded addresses
  // todo recount only new ones. prevent multiple instances simultaneous calculation
  getWalletsCountLast14Days = async (): Promise<any[]> => {
    try {
      const addRecord = async () => {
        isAddingRecord = true
        const [{count}] = await this.query(
          `select count(distinct("to")) from internal_transactions where value>0;`,
          []
        )
        await this.query(
          `insert into wallets_count (count, date_string) values($1, $2) on conflict (date_string) do nothing;`,
          [count, currentDateString]
        )
        isAddingRecord = false
      }

      const getRecords = async () => {
        const res = await this.query(
          `select date_string, "count" from wallets_count order by id asc limit 14;`,
          []
        )
        return res.map((o: any) => ({date: o.date_string, count: o.count})).reverse()
      }

      if (isAddingRecord) {
        return await getRecords()
      }

      const currentDateString = new Date().toISOString().split('T')[0]
      const lastRecord = await this.query(
        `select date_string from wallets_count order by id asc limit 1;`,
        []
      )

      if (!lastRecord.length || currentDateString !== lastRecord[0].date_string) {
        // fire in background
        addRecord()
      }

      return await getRecords()
    } catch (err) {
      isAddingRecord = false
      throw err
    }
  }
}
