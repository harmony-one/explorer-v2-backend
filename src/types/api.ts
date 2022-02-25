import * as blockchain from './blockchain'
export type FilterType = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'startsFrom'
export type FilterProperty =
  | 'number'
  | 'block_number'
  | 'address'
  | 'data'
  | 'needUpdate'
  | 'owner_address'
  | 'token_address'
  | 'transaction_type'
  | 'timestamp'

export type TransactionQueryField = 'block_number' | 'block_hash' | 'hash' | 'hash_harmony'
export type StakingTransactionQueryField = 'block_number' | 'block_hash' | 'hash'
export type InternalTransactionQueryField =
  | 'block_number'
  | 'transaction_hash'
  | 'block_hash'
  | 'address'

export type ContractQueryField = 'solidity_version' | 'ipfs_hash' | 'address' | 'creator_address'
export type ContractQueryValue = string

export type CountableEntities =
  | 'transactions'
  | 'blocks'
  | 'logs'
  | 'stakingTransactions'
  | 'internalTransactions'

export type TransactionQueryValue =
  | blockchain.BlockNumber
  | blockchain.BlockHash
  | blockchain.TransactionHash

export type FilterEntry = {
  type: FilterType
  property: FilterProperty
  value: number | string
}

export type FilterOrderBy = 'number' | 'block_number'

export type FilterOrderDirection = 'asc' | 'desc'
export type Filter = {
  offset?: number
  limit?: number
  orderDirection?: FilterOrderDirection
  orderBy?: FilterOrderBy
  filters: FilterEntry[]
}

export interface EthGetLogParams {
  fromBlock?: string | 'latest'
  toBlock?: string | 'latest'
  address?: string | string[]
  topics?: string[]
  blockhash?: string
}

export interface EthGetLogFilter {
  from?: number
  to?: number
  address?: string | string[]
  topics?: string[]
  blockhash?: string
}
