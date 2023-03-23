import {Log, IERC721, ContractEventType, ContractEvent} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'
import {ABIFactory} from './ABI'
import {logger} from 'src/logger'

import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {logTime} from 'src/utils/logTime'

const l = logger(module, 'erc1155')

type IParams = {
  token: IERC721
}

// logic
// add property update_needed
// set of addresses from Transfer event update needed
//
// todo filter out other topics

// 1155
/*
create token
mark ownership
*/

export const trackEvents = async (store: PostgresStorage, logs: Log[], {token}: IParams) => {
  const {getEntryByName, decodeLog, call} = ABIFactory(store.shardID)

  // todo track transfer batch
  const transferBatchEvent = getEntryByName('TransferBatch')!.signature
  const transferEventName = ContractEventType.TransferSingle
  const transferEvent = getEntryByName(transferEventName)!.signature

  const filteredLogs = logs.filter(({topics}) => topics.includes(transferEvent))
  if (filteredLogs.length > 0) {
    const addressesToUpdate = new Set<{
      address: string
      tokenAddress: string
      tokenId: string
      blockNumber: string
    }>() // unique addresses of senders and recipients

    const contractEvents = filteredLogs
      .map((log) => {
        const {blockNumber} = log
        const [topic0, ...topics] = log.topics
        const decodedLog = decodeLog(transferEventName, log.data, topics)

        if (decodedLog.from && decodedLog.to) {
          const tokenAddress = normalizeAddress(log.address) as string
          const from = normalizeAddress(decodedLog.from) as string
          const to = normalizeAddress(decodedLog.to) as string
          const {id: tokenId} = decodedLog
          const value =
            typeof decodedLog.value !== 'undefined'
              ? BigInt(decodedLog.value).toString()
              : undefined

          if (from !== zeroAddress) {
            addressesToUpdate.add({address: from, tokenAddress, tokenId, blockNumber})
          }
          if (to !== zeroAddress) {
            addressesToUpdate.add({address: to, tokenAddress, tokenId, blockNumber})
          }

          return {
            address: tokenAddress,
            from,
            to,
            value,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            transactionIndex: log.transactionIndex,
            transactionHash: log.transactionHash,
            transactionType: 'erc1155',
            eventType: transferEventName,
          } as ContractEvent
        }
      })
      .filter((e) => e) as ContractEvent[]

    // add related txs we mark them 721 table as all nft
    // todo add to token address
    // inserting into contract_events temporarily turned off to reduce the size of the DB
    const addEventsPromises: never[] = [] // contractEvents.map((e) => store.contract.addContractEvent(e))

    const updateAssetPromises = [...addressesToUpdate.values()].map((item) =>
      store.erc1155.addAsset(item.tokenAddress, item.tokenId, item.blockNumber)
    )

    const updateAssetBalancesPromises = [...addressesToUpdate.values()].map((item) =>
      store.erc1155.setNeedUpdateBalance(item.address, item.tokenAddress, item.tokenId)
    )

    await Promise.all([
      ...updateAssetPromises,
      ...addEventsPromises,
      ...updateAssetBalancesPromises,
    ])

    l.info(
      `${updateAssetPromises.length} tokens marked need update balances for "${token.name}" ${token.address}`
    )
  }

  // inserting into contract_events temporarily turned off to reduce the size of the DB

  // const approvalForAllLogs = logs.filter(({topics}) => topics.includes(approvalForAllSignature))
  // if (approvalForAllLogs.length > 0) {
  //   const events = approvalForAllLogs.map((log) => {
  //     const [topic0, ...topics] = log.topics
  //     const {_owner: owner, _operator: operator, _approved: approved} = decodeLog(
  //       ContractEventType.ApprovalForAll,
  //       log.data,
  //       topics
  //     )
  //     return {
  //       address: normalizeAddress(log.address),
  //       from: normalizeAddress(owner),
  //       to: normalizeAddress(operator),
  //       value: (+!!approved).toString(),
  //       blockNumber: log.blockNumber,
  //       logIndex: log.logIndex,
  //       transactionIndex: log.transactionIndex,
  //       transactionHash: log.transactionHash,
  //       transactionType: 'erc1155',
  //       eventType: ContractEventType.ApprovalForAll,
  //     } as ContractEvent
  //   })
  //   await Promise.all(events.map((e) => store.contract.addContractEvent(e)))
  // }
}
