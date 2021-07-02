import {
  Address,
  Block,
  BlockHash,
  BlockNumber,
  ByteCode,
  InternalTransaction,
  RPCBlockHarmony,
  RPCInternalTransactionFromBlockTrace,
  RPCStakingTransactionHarmony,
  RPCTransactionHarmony,
  TraceCallErrorToRevert,
  TraceCallTypes,
  TransactionHash,
} from 'src/types'
import {normalizeAddress} from 'src/utils/normalizeAddress'

export const mapBlockFromResponse = (block: RPCBlockHarmony): Block => {
  // @ts-ignore
  return {
    ...block,
    number: parseInt(block.number, 16),
    miner: normalizeAddress(block.miner),
    transactions: block.transactions && block.transactions.map(mapTransaction),
    stakingTransactions:
      block.stakingTransactions && block.stakingTransactions.map(mapStakingTransaction),
  } as Block
}

const mapTransaction = (tx: RPCTransactionHarmony) => {
  return {
    ...tx,
    to: normalizeAddress(tx.to),
    from: normalizeAddress(tx.from),
  }
}

const mapStakingTransaction = (tx: RPCStakingTransactionHarmony) => {
  // convert one1 to 0x
  // https://docs.harmony.one/home/developers/api/methods/transaction-related-methods/hmy_getstakingtransactionbyblockhashandindex
  const msg = {...tx.msg}
  if (msg.validatorAddress) {
    msg.validatorAddress = normalizeAddress(msg.validatorAddress)
  }
  if (msg.delegatorAddress) {
    msg.delegatorAddress = normalizeAddress(msg.delegatorAddress)
  }

  return {
    ...tx,
    to: normalizeAddress(tx.to),
    from: normalizeAddress(tx.from),
    msg,
  }
}

export const mapInternalTransactionFromBlockTrace = (blockNumber: BlockNumber) => (
  tx: RPCInternalTransactionFromBlockTrace
) => {
  const index = tx.traceAddress[0] !== undefined ? tx.traceAddress[0] : null

  return {
    blockHash: tx.blockHash,
    // block number is currently missing in the response sometimes
    blockNumber: tx.blockNumber || blockNumber,
    transactionHash: tx.transactionHash,
    from: tx.action.from,
    to: tx.action.to || tx.action.address || (tx.result ? tx.result.address : null),
    gas: tx.action.gas || '0x0', // can be undefined
    gasUsed: tx.result ? tx.result.gasUsed : '0x0',
    input: tx.action.input,
    output: tx.result ? tx.result.output : null,
    type: tx.action.callType || tx.type,
    error: [tx.error, tx.revert].filter((a) => a).join(':'),
    index:
      (tx.index || tx.transactionPosition || 0) +
      // todo 60 just to make sure that index is unique across block records
      (tx.traceAddress && tx.traceAddress.length ? tx.traceAddress[0] * 40 : 0),
    value: tx.action.value || '0x0', // can be undefined
    deployedBytecode: tx.result && tx.result.code ? tx.result.code : undefined,
  } as InternalTransaction
}
