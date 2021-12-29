import {
  Address,
  InternalTransaction,
  RPCTransaction,
  Block,
  RPCStakingTransactionHarmony,
  Filter,
} from 'src/types'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import * as RPCClient from 'src/indexer/rpc/client'
import {stores} from 'src/store'

const undelegateThresholdONE = 100000n * 10n ** 18n
const transferThresholdONE = 10000n * 10n ** 18n
const balanceThresholdONE = 1000000n * 10n ** 18n

const maxTransactionCount = 1

const maxEntries = 500
// todo
const maxExcludedEntries = 0

const entries = new Map()
const excludedAddresses = new Set()
type TType = 'staking' | 'internal' | 'transaction'

const addAddress = async (
  address: Address,
  value: any,
  type: TType,
  blockNumber: number,
  transactionHash: string
) => {
  if (excludedAddresses.has(address) || entries.has(address)) {
    return
  }

  const balance = await RPCClient.getBalance(0, address)
  if (BigInt(balance) < balanceThresholdONE) {
    return
  }

  const sentTxCount = await RPCClient.getTransactionCount(0, address, 'SENT')
  if (+sentTxCount > maxTransactionCount) {
    excludedAddresses.add(address)
    return
  }

  const payload = {
    address,
    type,
    blockNumber,
    transactionHash,
    balance: BigInt(balance).toString(),
    sentTxCount,
  }

  entries.set(address, payload)
  removeOldEntries()
}

export const addInternalTransaction = (internalTransaction: InternalTransaction, block: Block) => {
  const value = internalTransaction.value
  if (BigInt(value) < transferThresholdONE) {
    return
  }

  const address = internalTransaction.to
  addAddress(address, value, 'internal', +block.number, internalTransaction.transactionHash)
}

export const addTransaction = (transaction: RPCTransaction) => {
  const value = transaction.value
  if (BigInt(value) < transferThresholdONE) {
    return
  }

  const address = transaction.to
  addAddress(address, value, 'transaction', +transaction.blockNumber, transaction.hash)
}

export const addStakingTransaction = (stakingTransaction: RPCStakingTransactionHarmony) => {
  if (stakingTransaction.type !== 'Undelegate') {
    return
  }

  const value = stakingTransaction.msg.amount

  if (BigInt(value) < undelegateThresholdONE) {
    return
  }

  const address = normalizeAddress(stakingTransaction.msg.delegatorAddress)
  addAddress(address!, value, 'staking', +stakingTransaction.blockNumber, stakingTransaction.hash)
}

export const getEntries = () =>
  Array.from(entries.values()).sort((a, b) => b.blockNumber - a.blockNumber)

const removeOldEntries = () => {
  if (entries.size < maxEntries) {
    return
  }

  const limit = entries.size - maxEntries

  let i = 0
  for (let k of entries.keys()) {
    if (i++ > limit) {
      break
    }
    entries.delete(k)
  }
}

/*

 if (+txCount === 0) {
        const filter: Filter = {
            offset: 0,
            limit: maxTransactionCount + 1,
            orderBy: 'block_number',
            orderDirection: 'desc',
            filters: []
        }

        filter.filters.push({
            value: `'${address}'`,
            type: 'eq',
            property: 'address'
        })

        const storedTxs = await stores[0].address.getRelatedTransactionsByType(address, 'transaction', filter)
        const storedTxCount = storedTxs.length
        console.log({storedTxCount})
        if (storedTxCount > maxTransactionCount) {
            console.log('txCount return')
            // excludedAddresses.add(address)
            // return
        }
    }
*/
