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

  addOwner = (address: string, txHash: string, blockNumber: number) => {
    return this.query(
      `
            insert into onewallet_owners (address, transaction_hash, block_number) values($1, $2, $3)
            on conflict (address) do nothing;
      `,
      [address, txHash, blockNumber]
    )
  }

  getAddressesToUpdate = async (offset = 0, limit = 100000) => {
    const res: Array<{address: string}> = await this.query(
      `
      select * from onewallet_owners
      order by block_number desc
      offset $1
      limit $2
    `,
      [offset, limit]
    )
    return res.map((item) => item.address)
  }

  getAddressesToUpdateCount = async () => {
    const res = await this.query(
      `
      select count(*) from onewallet_owners
    `,
      []
    )
    return res[0].count
  }

  getMetricsLastUpdateDiff = async (): Promise<number> => {
    const res = await this.query(
      `
      SELECT extract(day from current_date - created_at) AS days
      from onewallet_metrics om 
      order by id desc 
      offset 0
      limit 1
    `,
      []
    )
    return res.length > 0 ? +res[0].days : Infinity
  }

  addMetrics = (count: string, totalBalance: string) => {
    return this.query(
      `
      insert into onewallet_metrics (owners_count, total_balance)
      values ($1, $2)
      on conflict (created_at) do nothing;
    `,
      [count, totalBalance]
    )
  }

  getMetrics = async (): Promise<{count: string; totalAmount: string}> => {
    const res = await this.query(
      `
            select owners_count as count, total_balance as balance
            from onewallet_metrics
            order by id desc
            limit 1
      `,
      []
    )

    return {
      count: res.length ? res[0].count : '0',
      totalAmount: res.length ? res[0].balance : '0',
    }
  }
}
