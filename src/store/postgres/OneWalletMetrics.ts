import {Query} from 'src/store/postgres/types'
import {Address} from 'src/types'

const oneWalletAddresses = [
  '0xc8cd0c9ca68b853f73917c36e9276770a8d8e4e0',
  '0xe0f4dda31750e410a7cc62f7aa5ae95fa56f050d',
].map((a) => a.toLowerCase())

export class PostgresStorageOneWalletMetrics {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  getWallets = async (): Promise<Address[]> => {
    const res = await this.query(
      `
            select "to" from internal_transactions
            where "from" = any ($1) and type='create'
      `,
      [oneWalletAddresses]
    )

    // @ts-ignore
    return res.map((r) => r.to)
  }
}
