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
}
