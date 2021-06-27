import {InternalTransaction, Contract, ByteCode} from 'src/types'
import {logger} from 'src/logger'
import base58 from 'bs58'
const l = logger(module)

export const contractAddressIndexer = (tx: InternalTransaction) => {
  if (tx.error) {
    return
  }

  if (!['create', 'create2'].includes(tx.type)) {
    return
  }

  const {IPFSHash, solidityVersion} = extractMetaFromBytecode(tx.deployedBytecode)

  if (!tx.deployedBytecode) {
    l.warn('Bytecode is missing from trace_block internal transaction result.code', tx)
  }

  const contract: Contract = {
    address: tx.to,
    creatorAddress: tx.from,
    blockHash: tx.blockHash,
    blockNumber: tx.blockNumber,
    transactionHash: tx.transactionHash,
    IPFSHash,
    solidityVersion,
    bytecode: tx.deployedBytecode || 'Missing from trace_block result.code',
  }

  return contract
}

// https://docs.soliditylang.org/en/v0.6.0/metadata.html
const solcVersionKey = '64736f6c6343'
const IPFSHashKey = '64697066735822'
const extractMetaFromBytecode = (bytecode: ByteCode | undefined) => {
  if (!bytecode) {
    return {}
  }

  const splitByKey = (key: string, len: number) => {
    const s = bytecode.split(key)
    if (s.length < 2) {
      return
    }
    return s[s.length - 1].slice(0, len)
  }
  const formatDigits = (digits: string) => {
    return parseInt(digits, 16)
  }

  let solidityVersion
  let IPFSHash
  const solcVersionHex = splitByKey(solcVersionKey, 6)

  if (solcVersionHex) {
    solidityVersion = [
      formatDigits(solcVersionHex[0] + solcVersionHex[1]),
      formatDigits(solcVersionHex[2] + solcVersionHex[3]),
      formatDigits(solcVersionHex[4] + solcVersionHex[5]),
    ].join('.')
  }

  const IPFSHashKeyHex = splitByKey(IPFSHashKey, 68)
  if (IPFSHashKeyHex) {
    const bytes = Buffer.from(IPFSHashKeyHex, 'hex')
    IPFSHash = base58.encode(bytes)
  }

  return {IPFSHash, solidityVersion}
}
