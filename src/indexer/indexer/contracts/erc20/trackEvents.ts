import {Log, IERC20, ContractEvent, ContractEventType} from 'src/types'
import {PostgresStorage} from 'src/store/postgres'
import {ABI} from './ABI'
import {logger} from 'src/logger'

const {getEntryByName, decodeLog} = ABI
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {logTime} from 'src/utils/logTime'

const l = logger(module, 'erc20')

const transferSignature = getEntryByName(ContractEventType.Transfer)!.signature
const approveSignature = getEntryByName(ContractEventType.Approval)!.signature

type IParams = {
  token: IERC20
}

// logic
// add property update_needed
// set of addresses from Transfer event update needed
//
// todo filter out other topics

export const trackEvents = async (store: PostgresStorage, logs: Log[], {token}: IParams) => {
  const transferLogs = logs.filter(({topics}) => topics.includes(transferSignature))

  if (transferLogs.length > 0) {
    const addressesToUpdate = new Set<string>() // unique addresses of senders and recipients
    const tokenAddress = transferLogs[0].address
    const transferEvents = transferLogs
      .map((log) => {
        const [topic0, ...topics] = log.topics
        const {from, to, value} = decodeLog(ContractEventType.Transfer, log.data, topics)
        if (![from, to].includes(zeroAddress)) {
          const fromNormalized = normalizeAddress(from) as string
          const toNormalized = normalizeAddress(to) as string

          addressesToUpdate.add(fromNormalized)
          addressesToUpdate.add(toNormalized)

          return {
            address: normalizeAddress(tokenAddress),
            from: fromNormalized,
            to: toNormalized,
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

    const updateBalancesPromises = [...addressesToUpdate.values()].map((address) =>
      store.erc20.setNeedUpdateBalance(address, tokenAddress)
    )
    const addEventsPromises = transferEvents.map((e) => store.contract.addContractEvent(e))

    await Promise.all(updateBalancesPromises.concat(addEventsPromises))

    l.info(
      `${updateBalancesPromises.length} addresses marked need update balances for "${token.name}" ${token.address}`
    )
  }

  const approveLogs = logs.filter(({topics}) => topics.includes(approveSignature))
  if (approveLogs.length > 0) {
    const approveEvents = approveLogs.map((log) => {
      const [topic0, ...topics] = log.topics
      const {_owner: owner, _spender: spender, _value: value} = decodeLog(
        ContractEventType.Approval,
        log.data,
        topics
      )
      return {
        address: normalizeAddress(spender),
        from: normalizeAddress(owner),
        to: '',
        value: typeof value !== 'undefined' ? BigInt(value).toString() : undefined,
        blockNumber: log.blockNumber,
        transactionIndex: log.transactionIndex,
        transactionHash: log.transactionHash,
        transactionType: 'erc20',
        eventType: ContractEventType.Approval,
      } as ContractEvent
    })
    await Promise.all(approveEvents.map((e) => store.contract.addContractEvent(e)))
  }
}
