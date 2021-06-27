import {
  ShardID,
  Block,
  Log,
  TransactionHash,
  BlockNumber,
  BlockHash,
  RPCTransactionHarmony,
  RPCStakingTransactionHarmony,
  Transaction,
  StakingTransaction,
  Address2Transaction,
  InternalTransaction,
  Contract,
  IERC20,
  IERC721,
  IERC1155,
} from 'src/types/blockchain'
import {
  Filter,
  TransactionQueryField,
  TransactionQueryValue,
  StakingTransactionQueryField,
  InternalTransactionQueryField,
} from 'src/types'
import {fromSnakeToCamelResponse, generateQuery} from 'src/store/postgres/queryMapper'
import {buildSQLQuery} from 'src/store/postgres/filters'

export interface IStorageBlock {
  addBlock: (block: Block) => Promise<any>
  addBlocks: (blocks: Block[]) => Promise<any>
  getBlockByNumber: (number: BlockNumber) => Promise<Block | null>
  getBlockByHash: (hash: BlockHash) => Promise<Block | null>
  getBlocks: (filter: Filter) => Promise<Block[]>
}

export interface IStorageLog {
  addLog: (block: Log) => Promise<any>
  getLogsByTransactionHash: (transactionHash: TransactionHash) => Promise<Log[] | null>
  getLogsByBlockNumber: (num: BlockNumber) => Promise<Log[] | null>
  getLogsByBlockHash: (hash: BlockHash) => Promise<Log[] | null>
  getLogs: (f: Filter) => Promise<Log[]>
}

export interface IStorageIndexer {
  getLastIndexedBlockNumber: () => Promise<number | null>
  setLastIndexedBlockNumber: (num: BlockNumber) => Promise<any>
  getLastIndexedLogsBlockNumber: () => Promise<number>
  setLastIndexedLogsBlockNumber: (num: BlockNumber) => Promise<any>
  getChainID: () => Promise<number>
}

export interface IStorageTransaction {
  addTransaction: (block: RPCTransactionHarmony) => Promise<any>
  addTransactions: (blocks: RPCTransactionHarmony[]) => Promise<any>
  getTransactionsByField: (
    field: TransactionQueryField,
    value: TransactionQueryValue
  ) => Promise<Transaction[]>
  getTransactions: (filter: Filter) => Promise<Transaction[]>
}

export interface IStorageContract {
  addContract: (contract: Contract) => any
  getContracts: (filter: Filter) => Promise<Contract[]>
}

export interface IStorageStakingTransaction {
  addStakingTransaction: (block: RPCStakingTransactionHarmony) => Promise<any>
  addStakingTransactions: (blocks: RPCStakingTransactionHarmony[]) => Promise<any>
  getStakingTransactionsByField: (
    field: StakingTransactionQueryField,
    value: TransactionQueryValue
  ) => Promise<StakingTransaction[]>
  getStakingTransactions: (filter: Filter) => Promise<StakingTransaction[]>
}

export interface IStorageInternalTransaction {
  getInternalTransactionsByField: (
    field: InternalTransactionQueryField,
    value: TransactionQueryValue
  ) => Promise<InternalTransaction[]>
  getInternalTransactions: (f: Filter) => Promise<InternalTransaction[]>
}

export interface IStorageAddress {
  addAddress2Transaction: (entry: Address2Transaction) => Promise<any>
  // getRelatedTransactions: (filter: Filter) => Promise<Address2Transaction[]>
}

export interface IStorageERC20 {
  updateERC20: (erc20: IERC20) => Promise<any>
  addERC20: (erc20: IERC20) => Promise<any>
}

export interface IStorageERC721 {
  updateERC721: (erc721: IERC721) => Promise<any>
  addERC721: (erc721: IERC721) => Promise<any>
}

export interface IStorageERC1155 {}

export interface IStorageSignature {
  // todo
}

export interface IStorageMetrics {
  // todo
}

export interface IStorage {
  block: IStorageBlock
  log: IStorageLog
  transaction: IStorageTransaction
  staking: IStorageStakingTransaction
  indexer: IStorageIndexer
  internalTransaction: IStorageInternalTransaction
  address: IStorageAddress
  contract: IStorageContract
  erc20: IStorageERC20
}
