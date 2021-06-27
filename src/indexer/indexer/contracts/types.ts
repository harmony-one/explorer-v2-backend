import {BlockNumber, Contract, Log} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'

export interface ContractTracker<T> {
  name: string
  tableName?: string
  trackEvents: {
    process: (store: PostgresStorage, logs: Log[], params: {token: T}) => Promise<any>
    getLastSyncedBlock: (store: PostgresStorage, token: T) => Promise<number>
    setLastSyncedBlock: (store: PostgresStorage, token: T, blockNumber: BlockNumber) => Promise<any>
    batchSize: number
  }
  addContract: {
    process: (store: PostgresStorage, contract: Contract) => Promise<any>
    batchSize: number
  }
  // onStart
  onFinish: (store: PostgresStorage) => Promise<any>
}

export type ABIEventSignature = string
export type ABIMethodSignature = string

type ABIEntry = {
  name: string
  type: 'event' | 'function'
  inputs: {name: string; type: 'string'; indexed: boolean}[]
  outputs: {name: string; type: 'string'}[] | undefined
}

export type IABI = ABIEntry[]
