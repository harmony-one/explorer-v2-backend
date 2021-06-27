import {
  Log,
  Address,
  IERC721,
  Address2Transaction,
  BlockNumber,
  TransactionHash,
  TransactionHarmonyHash,
  AddressTransactionType,
  IERC721TokenID,
} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'
import {ABI} from './ABI'
import {logger} from 'src/logger'

const {getEntryByName, decodeLog, call} = ABI
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {logTime} from 'src/utils/logTime'

const l = logger(module, 'erc1155')

const transferEventName = 'TransferSingle'
const transferEvent = getEntryByName(transferEventName)!.signature

// todo track transfer batch
const transferBatchEvent = getEntryByName('TransferBatch')!.signature

type IParams = {
  token: IERC721
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
  tokenId: IERC721TokenID
  value: string | number
}

// 1155
/*
create token
mark ownership
*/

export const trackEvents = async (store: PostgresStorage, logs: Log[], {token}: IParams) => {
  const filteredLogs = logs.filter(({topics}) => topics.includes(transferEvent))
  if (!filteredLogs.length) {
    return
  }

  const tokenAddress = filteredLogs[0].address

  const addressesForUpdate = new Map<Address, setEntry>()

  for (const log of filteredLogs) {
    const [topic0, ...topics] = log.topics
    const {operator, from, to, id: tokenId, value} = decodeLog(transferEventName, log.data, topics)

    addressesForUpdate.set(from, {
      address: from,
      blockNumber: +log.blockNumber,
      transactionHash: log.transactionHash,
      tokenId,
      value,
    })
    addressesForUpdate.set(to, {
      address: to,
      blockNumber: +log.blockNumber,
      transactionHash: log.transactionHash,
      tokenId,
      value,
    })
  }

  const arrFromSet = [...addressesForUpdate.values()].filter(
    (o) => ![zeroAddress].includes(o.address)
  )
  arrFromSet.forEach((o) => {
    o.address = normalizeAddress(o.address)!
  })

  // add related txs we mark them 721 table as all nft
  // todo add to token address
  const setAddress2Transactions = arrFromSet
    .map(
      (o) =>
        ({
          blockNumber: o.blockNumber,
          transactionHash: o.transactionHash,
          address: o.address,
          transactionType: 'erc721',
        } as Address2Transaction)
    )
    .map((o) => store.address.addAddress2Transaction(o))

  const setUpdateNeeded = arrFromSet.map((a) =>
    store.erc1155.setNeedUpdateAsset(tokenAddress, a.tokenId!)
  )

  const setUpdateBalanceNeeded = arrFromSet.map((a) =>
    store.erc1155.setNeedUpdateBalance(a.address!, tokenAddress, a.tokenId!)
  )

  await Promise.all([...setUpdateNeeded, ...setAddress2Transactions, ...setUpdateBalanceNeeded])

  l.info(
    `${setUpdateNeeded.length} tokens marked need update balances for "${token.name}" ${token.address}`
  )
}
