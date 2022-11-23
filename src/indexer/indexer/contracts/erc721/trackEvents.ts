import {Log, IERC721, ContractEventType, ContractEvent} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'
import {ABIFactory} from './ABI'
import {logger} from 'src/logger'

import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {logTime} from 'src/utils/logTime'

const l = logger(module, 'erc721')

type IParams = {
  token: IERC721
}

// logic
// add property update_needed
// set of addresses from Transfer event update needed
//
// todo filter out other topics

export const trackEvents = async (store: PostgresStorage, logs: Log[], {token}: IParams) => {
  const {getEntryByName, decodeLog, call} = ABIFactory(store.shardID)

  const transferSignature = getEntryByName(ContractEventType.Transfer)!.signature
  const approvalSignature = getEntryByName(ContractEventType.Approval)!.signature
  const approvalForAllSignature = getEntryByName(ContractEventType.ApprovalForAll)!.signature

  const filteredLogs = logs.filter(({topics}) => topics.includes(transferSignature))
  if (filteredLogs.length > 0) {
    const addressesToUpdate = new Set<{address: string; tokenAddress: string; tokenId: string}>() // unique addresses of senders and recipients

    const contractEvents = filteredLogs
      .map((log) => {
        const [topic0, ...topics] = log.topics
        const decodedLog = decodeLog(ContractEventType.Transfer, log.data, topics)
        if (![decodedLog.from, decodedLog.to].includes(zeroAddress)) {
          const tokenAddress = normalizeAddress(log.address) as string
          const from = normalizeAddress(decodedLog.from) as string
          const to = normalizeAddress(decodedLog.to) as string
          const {tokenId} = decodedLog
          const value =
            typeof decodedLog.value !== 'undefined'
              ? BigInt(decodedLog.value).toString()
              : undefined

          addressesToUpdate.add({address: from, tokenAddress, tokenId})
          addressesToUpdate.add({address: to, tokenAddress, tokenId})

          return {
            address: tokenAddress,
            from,
            to,
            value,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            transactionIndex: log.transactionIndex,
            transactionHash: log.transactionHash,
            transactionType: 'erc721',
            eventType: ContractEventType.Transfer,
          } as ContractEvent
        }
      })
      .filter((e) => e) as ContractEvent[]

    // todo burn token?
    const addEventsPromises = contractEvents.map((e) => store.contract.addContractEvent(e))
    const updateAssetPromises = [...addressesToUpdate.values()].map((item) =>
      store.erc721.setNeedUpdateAsset(item.address, item.tokenAddress, item.tokenId)
    )

    await Promise.all(updateAssetPromises.concat(addEventsPromises))

    l.info(
      `${updateAssetPromises.length} tokens marked need update balances for "${token.name}" ${token.address}`
    )
  }

  const approvalForAllLogs = logs.filter(({topics}) => topics.includes(approvalForAllSignature))
  if (approvalForAllLogs.length > 0) {
    const events = approvalForAllLogs.map((log) => {
      const [topic0, ...topics] = log.topics
      const {owner, operator, approved} = decodeLog(
        ContractEventType.ApprovalForAll,
        log.data,
        topics
      )
      return {
        address: normalizeAddress(log.address),
        from: normalizeAddress(owner),
        to: normalizeAddress(operator),
        value: (+!!approved).toString(),
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionIndex: log.transactionIndex,
        transactionHash: log.transactionHash,
        transactionType: 'erc721',
        eventType: ContractEventType.ApprovalForAll,
      } as ContractEvent
    })
    await Promise.all(events.map((e) => store.contract.addContractEvent(e)))
  }

  const approvalLogs = logs.filter(({topics}) => topics.includes(approvalSignature))
  if (approvalLogs.length > 0) {
    const events = approvalLogs.map((log) => {
      const [topic0, ...topics] = log.topics
      const {owner, approved, tokenId} = decodeLog(
        ContractEventType.ApprovalForAll,
        log.data,
        topics
      )
      return {
        address: normalizeAddress(log.address),
        from: normalizeAddress(owner),
        to: '',
        value: (+!!approved).toString(),
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionIndex: log.transactionIndex,
        transactionHash: log.transactionHash,
        transactionType: 'erc721',
        eventType: ContractEventType.ApprovalForAll,
      } as ContractEvent
    })
    await Promise.all(events.map((e) => store.contract.addContractEvent(e)))
  }
}
