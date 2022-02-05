import {Query} from 'src/store/postgres/types'

export class PostgresStorageUtils {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  getMissingBlocks = async (fromBlock: number, toBlock: number): Promise<number[]> => {
    if (!Number.isInteger(fromBlock) || !Number.isInteger(toBlock)) {
      throw new Error(`both "from" and "to" params should be set, got ${fromBlock}-${toBlock}`)
    }

    const res = await this.query(
      `
        SELECT s.id AS missing_ids
        FROM generate_series(${fromBlock}, ${toBlock}) s(id)
        WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE number = s.id);
        `,
      []
    )

    return res.map((r: any) => r.missing_ids)
  }
}
