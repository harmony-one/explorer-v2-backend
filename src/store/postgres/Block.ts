import {IStorageBlock} from 'src/store/interface'
import {Block, BlockHash, BlockNumber, ShardID} from 'src/types/blockchain'
import {Filter} from 'src/types/api'
import {generateQuery, fromSnakeToCamelResponse} from './queryMapper'
import {buildSQLQuery} from './filters'
import {Query} from 'src/store/postgres/types'

export class PostgresStorageBlock implements IStorageBlock {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addBlocks = async (blocks: Block[]) => {
    return Promise.all(blocks.map((b) => this.addBlock(b)))
  }

  addBlock = async (block: Block) => {
    // todo
    // @ts-ignore
    const newBlock = {
      ...block,
      stakingTransactions: block.stakingTransactions.map(({hash}) => hash),
      transactions: block.transactions.map(({ethHash}) => ethHash),
    }
    const {query, params} = generateQuery(newBlock)

    return await this.query(`insert into blocks ${query} on conflict (number) do nothing;`, params)
  }

  getBlockByNumber = async (num: BlockNumber): Promise<Block | null> => {
    const res = await this.query(`select * from blocks where number = $1;`, [num])

    return fromSnakeToCamelResponse(res[0]) as Block
  }

  getBlockByHash = async (hash: BlockHash): Promise<Block | null> => {
    const res = await this.query(
      `select *
                                  from blocks
                                  where hash = $1;`,
      [hash]
    )

    return fromSnakeToCamelResponse(res[0]) as Block
  }

  getBlocks = async (filter: Filter): Promise<Block[]> => {
    const q = buildSQLQuery(filter)
    const res = await this.query(`select * from blocks ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getLatestBlockNumber = async (): Promise<number> => {
    const res = await this.query(`select * from indexer_state where indexer_name = 'blocks'`, [])
    return +res[0].last_synced_block_number
  }
}
