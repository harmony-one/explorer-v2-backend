import {
  Log,
  Address,
  IERC20,
  Address2Transaction,
  BlockNumber,
  TransactionHash,
  TransactionHarmonyHash,
  AddressTransactionType,
} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'
import {ABI} from './ABI'
import {logger} from 'src/logger'

const {getEntryByName, decodeLog} = ABI
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {logTime} from 'src/utils/logTime'

const l = logger(module, 'erc20')

const transferEvent = getEntryByName('Transfer')!.signature

type IParams = {
  token: IERC20
}

// logic
// add property update_needed
// set of addresses from Transfer event update needed
//
// todo filter out other topics

type setEntry = {
  address: Address
  blockNumber: BlockNumber
  transactionHash: TransactionHash
}

export const trackEvents = async (store: PostgresStorage, logs: Log[], {token}: IParams) => {
  const filteredLogs = logs.filter(({topics}) => topics.includes(transferEvent))
  if (!filteredLogs.length) {
    return
  }
  const tokenAddress = filteredLogs[0].address

  const addressesForUpdate = new Map<Address, setEntry>()

  for (const log of filteredLogs) {
    const [topic0, ...topics] = log.topics
    const {from, to, value} = decodeLog('Transfer', log.data, topics)

    addressesForUpdate.set(from, {
      address: from,
      blockNumber: +log.blockNumber,
      transactionHash: log.transactionHash,
    })
    addressesForUpdate.set(to, {
      address: to,
      blockNumber: +log.blockNumber,
      transactionHash: log.transactionHash,
    })
  }

  const arrFromSet = [...addressesForUpdate.values()].filter(
    (o) => ![zeroAddress].includes(o.address)
  )
  arrFromSet.forEach((o) => {
    o.address = normalizeAddress(o.address)!
  })

  // add related txs
  const setAddress2Transactions = arrFromSet
    .map(
      (o) =>
        ({
          blockNumber: o.blockNumber,
          transactionHash: o.transactionHash,
          address: o.address,
          transactionType: 'erc20',
        } as Address2Transaction)
    )
    .map((o) => store.address.addAddress2Transaction(o))

  const setUpdateNeeded = arrFromSet
    .map((o) => o.address)
    .map((a) => store.erc20.setNeedUpdateBalance(a!, tokenAddress))

  await Promise.all(setUpdateNeeded.concat(setAddress2Transactions))

  l.info(
    `${setUpdateNeeded.length} addresses marked need update balances for "${token.name}" ${token.address}`
  )
}
