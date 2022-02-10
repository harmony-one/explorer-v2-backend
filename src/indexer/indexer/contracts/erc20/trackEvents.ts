import {Log, IERC20, ContractEvent, ContractEventType} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'
import {ABI} from './ABI'
import {logger} from 'src/logger'

const {getEntryByName, decodeLog} = ABI
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {logTime} from 'src/utils/logTime'

const l = logger(module, 'erc20')

const transferEvent = getEntryByName(ContractEventType.Transfer)!.signature

type IParams = {
  token: IERC20
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
  const addressesToUpdate = new Set<string>() // unique addresses of senders and recipients

  const contractEvents = filteredLogs
    .map((log) => {
      const [topic0, ...topics] = log.topics
      const {from, to, value} = decodeLog(ContractEventType.Transfer, log.data, topics)
      if (![from, to].includes(zeroAddress)) {
        addressesToUpdate.add(from)
        addressesToUpdate.add(to)
        return {
          address: normalizeAddress(tokenAddress),
          from: normalizeAddress(from),
          to: normalizeAddress(to),
          value: typeof value !== 'undefined' ? BigInt(value).toString() : undefined,
          blockNumber: log.blockNumber,
          transactionIndex: log.transactionIndex,
          transactionHash: log.transactionHash,
          transactionType: 'erc20',
          eventType: ContractEventType.Transfer,
        } as ContractEvent
      }
    })
    .filter((e) => e) as ContractEvent[]

  const addEventsPromises = contractEvents.map((e) => store.contract.addContractEvent(e))
  const updateBalancesPromises = [...addressesToUpdate.values()].map((address) =>
    store.erc20.setNeedUpdateBalance(address, tokenAddress)
  )

  await Promise.all(updateBalancesPromises.concat(addEventsPromises))

  l.info(
    `${updateBalancesPromises.length} addresses marked need update balances for "${token.name}" ${token.address}`
  )
}
