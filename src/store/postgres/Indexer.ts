import {IStorageIndexer} from 'src/store/interface'
import {BlockNumber} from 'src/types/blockchain'

import {Query} from 'src/store/postgres/types'

export class PostgresStorageIndexer implements IStorageIndexer {
  query: Query
  constructor(query: Query) {
    this.query = query
  }

  getChainID = async (): Promise<number> => {
    const res = await this.query(
      `select chain_id from indexer_state where indexer_name='blocks';`,
      []
    )

    const chainID = res && res[0] && +res[0][`chain_id`]
    return chainID || 0
  }

  updateChainID = async (chainID: number | string): Promise<any> => {
    if (!+chainID) {
      return
    }

    const res = await this.query(
      `update indexer_state set chain_id=$1 where indexer_name='blocks';`,
      [chainID]
    )
  }

  getLastIndexedBlockNumber = async (): Promise<number | null> => {
    const res = await this.query(
      `select last_synced_block_number from indexer_state where indexer_name='blocks';`,
      []
    )
    const lastIndexedBlock = +res[0][`last_synced_block_number`]
    return lastIndexedBlock || 0
  }

  setLastIndexedBlockNumber = async (num: BlockNumber): Promise<number> => {
    return this.query(
      `update indexer_state set last_synced_block_number=$1 where indexer_name='blocks';`,
      [num]
    )
  }

  getLastIndexedLogsBlockNumber = async (): Promise<number> => {
    const res = await this.query(
      `select last_synced_block_number from indexer_state where indexer_name='logs';`,
      []
    )

    const lastIndexedBlock = +res[0][`last_synced_block_number`]
    return lastIndexedBlock || 0
  }

  setLastIndexedLogsBlockNumber = async (num: BlockNumber): Promise<number> => {
    return this.query(
      `update indexer_state set last_synced_block_number=$1 where indexer_name='logs';`,
      [num]
    )
  }

  getLastIndexedBlockNumberByName = async (name: string): Promise<number> => {
    const res = await this.query(
      `select last_synced_block_number from indexer_state where indexer_name=$1;`,
      [name]
    )

    const lastIndexedBlock = +res[0][`last_synced_block_number`]
    return lastIndexedBlock || 0
  }

  setLastIndexedBlockNumberByName = async (name: string, num: BlockNumber): Promise<number> => {
    return this.query(
      `update indexer_state set last_synced_block_number=$1 where indexer_name=$2;`,
      [num, name]
    )
  }
}
