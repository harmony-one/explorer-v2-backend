import {Log, IERC721, ContractEventType, ContractEvent} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'
import {ABI} from './ABI'
import {logger} from 'src/logger'

const {getEntryByName, decodeLog, call} = ABI
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {logTime} from 'src/utils/logTime'

const l = logger(module, 'erc721')

const transferEvent = getEntryByName(ContractEventType.Transfer)!.signature

type IParams = {
  token: IERC721
}

// logic
// add property update_needed
// set of addresses from Transfer event update needed
//
// todo filter out other topics

export const trackEvents = async (store: PostgresStorage, logs: Log[], {token}: IParams) => {
  const filteredLogs = logs.filter(({topics}) => topics.includes(transferEvent))
  if (!filteredLogs.length) {
    return
  }
  const tokenAddress = filteredLogs[0].address
  const addressesToUpdate = new Set<{address: string; tokenId: string}>() // unique addresses of senders and recipients

  const contractEvents = filteredLogs
    .map((log) => {
      const [topic0, ...topics] = log.topics
      const {from, to, value, tokenId} = decodeLog(ContractEventType.Transfer, log.data, topics)
      if (![from, to].includes(zeroAddress)) {
        addressesToUpdate.add({address: from, tokenId})
        addressesToUpdate.add({address: to, tokenId})
        return {
          address: normalizeAddress(tokenAddress),
          from: normalizeAddress(from),
          to: normalizeAddress(to),
          value: typeof value !== 'undefined' ? BigInt(value).toString() : undefined,
          blockNumber: log.blockNumber,
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
    store.erc721.setNeedUpdateAsset(item.address, tokenAddress, item.tokenId)
  )

  await Promise.all(updateAssetPromises.concat(addEventsPromises))

  l.info(
    `${updateAssetPromises.length} tokens marked need update balances for "${token.name}" ${token.address}`
  )
}
