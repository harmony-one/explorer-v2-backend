import {Query} from 'src/store/postgres/types'
import {Address} from 'src/types'

const OneWalletAddress = '0xc8cd0c9ca68b853f73917c36e9276770a8d8e4e0'

export class PostgresStorageOneWalletMetrics {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  getWallets = async (): Promise<Address[]> => {
    const res = await this.query(
      `select "to" from internal_transactions where "from"=$1 and type='create'`,
      [OneWalletAddress]
    )

    // @ts-ignore
    return res.map((r) => r.to)
  }
}
