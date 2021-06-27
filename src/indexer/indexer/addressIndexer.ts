import {
  Address2Transaction,
  Address,
  BlockHash,
  Block,
  TransactionHash,
  TransactionHarmonyHash,
  AddressTransactionType,
} from 'src/types'

export const AddressIndexer = () => {
  const sets: Record<string, Set<Address>> = {}

  const add = (
    block: Block,
    transactionHash: TransactionHash | TransactionHarmonyHash,
    transactionType: AddressTransactionType,
    ...addresses: Address[]
  ) => {
    const key = `${block.number}:${transactionHash}:${transactionType}`
    if (!sets[key]) {
      sets[key] = new Set()
    }
    const set = sets[key]

    addresses.filter((a) => a).map((address) => set.add(address))
  }

  const get = () => {
    return Object.keys(sets).reduce((a, key: BlockHash) => {
      const [blockNumber, transactionHash, transactionType] = key.split(':')
      sets[key].forEach((address) => {
        a.push({
          blockNumber: +blockNumber,
          transactionHash,
          address,
          transactionType,
        } as Address2Transaction)
      })

      return a
    }, [] as Address2Transaction[])
  }

  return {
    add,
    get,
  }
}
