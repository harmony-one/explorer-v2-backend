import {PostgresStorage} from 'src/store/postgres'
import {config} from 'src/config'
import {ShardID} from 'src/types/blockchain'
import {PostgresStorageOptions} from './postgres/types'

const shards: ShardID[] = [0, 1, 2, 3]

const indexerPools = config.indexer.isEnabled
  ? shards.map((shardID) => {
      const p = config.store.postgres[shardID]
      return new PostgresStorage({...p, shardID} as PostgresStorageOptions)
    })
  : null

const APIPools = config.api.isEnabled
  ? shards.map((shardID) => {
      const p = config.store.postgres[shardID]
      return new PostgresStorage({...p, shardID} as PostgresStorageOptions)
    })
  : null

export const stores = indexerPools || APIPools || []

export const storesAPI = APIPools || indexerPools || []
