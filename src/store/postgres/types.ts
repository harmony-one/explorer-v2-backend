import {ShardID} from 'src/types/blockchain'

export type Query = (sql: string, params: any[], retries?: number) => Promise<any>

export type PostgresStorageOptions = {
  shardID: ShardID
  user: string
  host: string
  database: string
  password: string
  port: number
  poolSize: number
}
