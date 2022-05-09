import {transport} from './transport'
import {config} from 'src/config'
import {
  Block,
  RPCBlock,
  ShardID,
  TransactionHash,
  RPCTransactionHarmony,
  Topic,
  Address,
  BlockNumber,
  Log,
  InternalTransaction,
  ByteCode,
  TransactionReceipt,
} from 'types/blockchain'
import {mapBlockFromResponse, mapInternalTransactionFromBlockTrace} from './mappers'
import {mainnetChainID} from 'src/constants'

// todo remove shard ID
export const getBlocks = (
  shardID: ShardID,
  fromBlock: BlockNumber,
  toBlock: BlockNumber,
  fullTx = true,
  withSigners = false,
  inclStaking = true
): Promise<Block[]> => {
  const from = '0x' + fromBlock.toString(16)
  const to = '0x' + toBlock.toString(16)

  const o = {
    fullTx,
    withSigners,
    // disable including staking txs for main net before 3358745 where implemented
    inclStaking: config.indexer.chainID === mainnetChainID && +to >= 3358745 ? inclStaking : false,
  }
  return transport(shardID, 'hmy_getBlocks', [from, to, o]).then((blocks) =>
    blocks.map(mapBlockFromResponse)
  )
}

export const getBlockByNumber = (
  shardID: ShardID,
  num: BlockNumber | 'latest',
  isFullInfo = true
): Promise<Block> => {
  return transport(shardID, 'eth_getBlockByNumber', [num, isFullInfo]).then(mapBlockFromResponse)
}

export const getTransactionByHash = (
  shardID: ShardID,
  hash: TransactionHash
): Promise<RPCTransactionHarmony> => {
  return transport(shardID, 'eth_getTransactionByHash', [hash])
}

export const getLogs = (
  shardID: ShardID,
  fromBlock: BlockNumber,
  toBlock: BlockNumber,
  address?: Address,
  topics?: Topic[]
): Promise<Log[]> => {
  const o = {
    topics,
    address,
    fromBlock: '0x' + fromBlock.toString(16),
    toBlock: '0x' + toBlock.toString(16),
  }
  return transport(shardID, 'eth_getLogs', [o])
}

export const getBalance = (shardID: ShardID, address: Address): Promise<string> => {
  return transport(shardID, 'hmy_getBalance', [address, 'latest'])
}

type transactionCountType = 'ALL' | 'RECEIVED' | 'SENT'
export const getTransactionCount = (
  shardID: ShardID,
  address: Address,
  type: transactionCountType = 'ALL'
): Promise<TransactionReceipt> => {
  return transport(shardID, 'hmyv2_getTransactionsCount', [address, type])
}

export const getTransactionReceipt = (
  shardID: ShardID,
  hash: TransactionHash
): Promise<TransactionReceipt> => {
  return transport(shardID, 'hmyv2_getTransactionReceipt', [hash])
}

export const getTransactionTrace = (
  shardID: ShardID,
  hash: TransactionHash,
  tracer: 'callTracer' = 'callTracer'
): Promise<InternalTransaction> => {
  return transport(shardID, 'debug_traceTransaction', [hash, {tracer}])
}

// these blocks always fails
const corruptedTraceBlocks = [4864036, 8027779]
export const traceBlock = (
  shardID: ShardID,
  blockNumber: BlockNumber
): Promise<InternalTransaction[]> => {
  if (config.indexer.chainID === mainnetChainID && corruptedTraceBlocks.includes(blockNumber)) {
    return Promise.resolve([])
  }

  const hex = '0x' + blockNumber.toString(16)
  return transport(shardID, 'trace_block', [hex]).then((txs) =>
    txs
      ? txs
          .map(mapInternalTransactionFromBlockTrace(blockNumber))
          // filter out suicide type as we don't need them
          .filter((t: InternalTransaction) => t.type !== 'suicide')
      : []
  )
}

// testnet ID 1666700000
export const getChainID = (shardID: ShardID): Promise<number> => {
  return transport(shardID, 'eth_chainId', []).then((r) => parseInt(r, 16))
}

export const getCode = (shardID: ShardID, address: Address): Promise<number> => {
  return transport(shardID, 'eth_getCode', [address, 'latest'])
}

type Call = {
  to: Address
  from?: Address
  gas?: string
  gasPrice?: string
  data: string
  value?: string
}
export const call = (
  shardID: ShardID,
  params: Call,
  blockNumber: BlockNumber | 'latest' | 'earliest' | 'pending' = 'latest'
): Promise<ByteCode> => {
  return transport(shardID, 'hmy_call', [params, blockNumber])
}
