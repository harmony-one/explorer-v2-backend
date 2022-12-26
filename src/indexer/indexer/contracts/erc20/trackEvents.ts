import {Log, IERC20, ContractEvent, ContractEventType} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'
import {ABIFactory} from './ABI'
import {logger} from 'src/logger'

import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {logTime} from 'src/utils/logTime'

const l = logger(module, 'erc20')

type IParams = {
  token: IERC20
}

// logic
// add property update_needed
// set of addresses from Transfer event update needed
//
// todo filter out other topics

export const trackEvents = async (store: PostgresStorage, logs: Log[], {token}: IParams) => {
  const {getEntryByName, decodeLog} = ABIFactory(store.shardID)

  const transferSignature = getEntryByName(ContractEventType.Transfer)!.signature
  const approveSignature = getEntryByName(ContractEventType.Approval)!.signature

  const transferLogs = logs.filter(({topics}) => topics.includes(transferSignature))

  if (transferLogs.length > 0) {
    const addressesToUpdate = new Set<{address: string; tokenAddress: string}>() // unique addresses of senders and recipients
    const transferEvents = transferLogs
      .map((log) => {
        const [topic0, ...topics] = log.topics
        const decodedLog = decodeLog(ContractEventType.Transfer, log.data, topics)
        const tokenAddress = normalizeAddress(log.address) as string
        const from = normalizeAddress(decodedLog.from) as string
        const to = normalizeAddress(decodedLog.to) as string
        const value =
          typeof decodedLog.value !== 'undefined' ? BigInt(decodedLog.value).toString() : undefined

        if (from !== zeroAddress) {
          addressesToUpdate.add({address: from, tokenAddress})
        }
        if (to !== zeroAddress) {
          addressesToUpdate.add({address: to, tokenAddress})
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
          transactionType: 'erc20',
          eventType: ContractEventType.Transfer,
        } as ContractEvent
      })
      .filter((e) => e) as ContractEvent[]

    const updateBalancesPromises = [...addressesToUpdate.values()].map(({address, tokenAddress}) =>
      store.erc20.setNeedUpdateBalance(address, tokenAddress)
    )
    // inserting into contract_events temporarily turned off to reduce the size of the DB
    const addEventsPromises: never[] = [] // transferEvents.map((e) => store.contract.addContractEvent(e))

    await Promise.all(updateBalancesPromises.concat(addEventsPromises))

    l.info(
      `${updateBalancesPromises.length} addresses marked need update balances for "${token.name}" ${token.address}`
    )
  }

  // inserting into contract_events temporarily turned off to reduce the size of the DB

  // const approveLogs = logs.filter(({topics}) => topics.includes(approveSignature))
  // if (approveLogs.length > 0) {
  //   const approveEvents = approveLogs.map((log) => {
  //     const [topic0, ...topics] = log.topics
  //     const {_owner, _spender, _value: value} = decodeLog(
  //       ContractEventType.Approval,
  //       log.data,
  //       topics
  //     )
  //     return {
  //       address: normalizeAddress(log.address),
  //       from: normalizeAddress(_owner),
  //       to: normalizeAddress(_spender),
  //       value: typeof value !== 'undefined' ? BigInt(value).toString() : undefined,
  //       blockNumber: log.blockNumber,
  //       logIndex: log.logIndex,
  //       transactionIndex: log.transactionIndex,
  //       transactionHash: log.transactionHash,
  //       transactionType: 'erc20',
  //       eventType: ContractEventType.Approval,
  //     } as ContractEvent
  //   })
  //   await Promise.all(approveEvents.map((e) => store.contract.addContractEvent(e)))
  // }
}
