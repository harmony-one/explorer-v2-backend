/*
 * Contract Events migrator
 * Workflow:
 * 1) get all erc20, 721, 1155 contract addresses from DB
 * 2) get logs with given blocks range
 * 3) filter logs with contract addresses from step 1, parse with event type (Transfer, TransferSingle)
 * 4) write parsed events to table 'contract_events'
 * 5) goto step 2, repeat
 * */

import fs from 'fs'
import {init as configInit} from 'src/config'
import {ContractEvent, ContractEventType, ContractType, Log} from 'src/types'
import {logger} from 'src/logger'
import {stores} from 'src/store'
import {ABIFactory as erc20ABIFactory} from 'src/indexer/indexer/contracts/erc20/ABI'
import {ABIFactory as erc721ABIFactory} from 'src/indexer/indexer/contracts/erc721/ABI'
import {ABIFactory as erc1155ABIFactory} from 'src/indexer/indexer/contracts/erc1155/ABI'
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'

const l = logger(module, `ContractEventsMigrator`)

const SHARD_ID = 0

const erc20ABI = erc20ABIFactory(SHARD_ID)
const erc721ABI = erc721ABIFactory(SHARD_ID)
const erc1155ABI = erc1155ABIFactory(SHARD_ID)

const START_BLOCK_NUMBER = 23167800 // start block_number from logs table
const FINISH_BLOCK_NUMBER = 23281610 // end block_number from logs table
const BLOCKS_BATCH_SIZE = 1000

const SUCCESS_SLEEP_TIMEOUT = 100
const FAIL_SLEEP_TIMEOUT = 60000

const sleep = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout))

const getLogs = (blocksFrom: number, blocksTo: number) => {
  const store = stores[SHARD_ID]
  return store.log.getLogs({
    filters: [
      {
        type: 'gte',
        property: 'block_number',
        value: blocksFrom,
      },
      {
        type: 'lte',
        property: 'block_number',
        value: blocksTo,
      },
    ],
    // orderBy: 'block_number',
    // orderDirection: 'asc',
    // offset: 0,
    limit: 100000000, // do not comment - required by filter (otherwise will be set to 10 by default)
  })
}

const getTokensMapFromFile = (filename: string) => {
  const tokensMap: Record<string, string> = {}
  fs.readFileSync(filename, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const [address, _, symbol] = line.split('\t')
      tokensMap[address] = symbol
    })
  return tokensMap
}

const getErc20Map = async () => {
  const contracts = await stores[SHARD_ID].erc20.getAllERC20()
  return contracts.reduce((acc: any, value) => {
    acc[value.address] = value.symbol
    return acc
  }, {})
}

const getErc721Map = async () => {
  const contracts = await stores[SHARD_ID].erc721.getAllERC721()
  return contracts.reduce((acc: any, value) => {
    acc[value.address] = value.symbol
    return acc
  }, {})
}

const getErc1155Map = async () => {
  const contracts = await stores[SHARD_ID].erc1155.getAllERC1155()
  return contracts.reduce((acc: any, value) => {
    acc[value.address] = value.symbol
    return acc
  }, {})
}

const mapTransferEvent = (
  log: Log,
  contractType: ContractType,
  eventType: ContractEventType,
  abi: any
) => {
  const {decodeLog} = abi
  const {address: tokenAddress} = log
  const [topic0, ...topics] = log.topics
  const {from, to, value} = decodeLog(eventType, log.data, topics)
  if (![from, to].includes(zeroAddress)) {
    return {
      address: normalizeAddress(tokenAddress),
      from: normalizeAddress(from),
      to: normalizeAddress(to),
      value: typeof value !== 'undefined' ? BigInt(value).toString() : undefined,
      blockNumber: log.blockNumber,
      transactionIndex: log.transactionIndex,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      transactionType: contractType,
      eventType,
    } as ContractEvent
  }
}

const mapApprovalEvent = (
  log: Log,
  contractType: ContractType,
  eventType: ContractEventType,
  abi: any
) => {
  const {decodeLog} = abi
  const {address} = log
  const [topic0, ...topics] = log.topics
  const {_owner, _spender, _value: value} = decodeLog(eventType, log.data, topics)
  return {
    address: normalizeAddress(address),
    from: normalizeAddress(_owner),
    to: normalizeAddress(_spender),
    value: typeof value !== 'undefined' ? BigInt(value).toString() : undefined,
    blockNumber: log.blockNumber,
    transactionIndex: log.transactionIndex,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    transactionType: contractType,
    eventType,
  } as ContractEvent
}

const mapApproval721Event = (
  log: Log,
  contractType: ContractType,
  eventType: ContractEventType,
  abi: any
) => {
  const {decodeLog} = abi
  const {address} = log
  const [topic0, ...topics] = log.topics
  const {owner, approved, tokenId} = decodeLog(eventType, log.data, topics)
  return {
    address: normalizeAddress(address),
    from: normalizeAddress(owner),
    to: '',
    value: (+!!approved).toString(),
    blockNumber: log.blockNumber,
    transactionIndex: log.transactionIndex,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    transactionType: contractType,
    eventType,
  } as ContractEvent
}

const mapApprovalForAllEvent = (
  log: Log,
  contractType: ContractType,
  eventType: ContractEventType,
  abi: any
) => {
  const {decodeLog} = abi
  const [topic0, ...topics] = log.topics
  // various format for hrc721 and hrc1155
  const {owner, _owner, operator, _operator, approved, _approved} = decodeLog(
    eventType,
    log.data,
    topics
  )
  return {
    address: normalizeAddress(log.address),
    from: normalizeAddress(owner || _owner),
    to: normalizeAddress(operator || _operator),
    value: (+!!(approved || _approved)).toString(),
    blockNumber: log.blockNumber,
    transactionIndex: log.transactionIndex,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    transactionType: contractType,
    eventType,
  } as ContractEvent
}

const writeContractEventsToDbBatch = async (events: ContractEvent[]) => {
  const size = 1000
  const store = stores[SHARD_ID]
  for (let i = 0; i < events.length; i += size) {
    await store.contract.addContractEventsBatch(events.slice(i, i + size))
  }
}

const parseLogs = (
  logs: Log[],
  contractType: ContractType,
  eventType: ContractEventType,
  abi: any
): ContractEvent[] => {
  const {getEntryByName} = abi
  const eventSignature = getEntryByName(eventType)!.signature
  const filteredLogs = logs.filter(({topics}) => topics.includes(eventSignature))
  if (!filteredLogs.length) {
    return []
  }
  return filteredLogs
    .map((log) => {
      try {
        if (eventType === ContractEventType.Approval) {
          if (contractType === 'erc721') {
            return mapApproval721Event(log, contractType, eventType, abi)
          }
          return mapApprovalEvent(log, contractType, eventType, abi)
        }
        if (eventType === ContractEventType.ApprovalForAll) {
          return mapApprovalForAllEvent(log, contractType, eventType, abi)
        }
        return mapTransferEvent(log, contractType, eventType, abi)
        // eslint-disable-next-line no-empty
      } catch (_) {}
    })
    .filter((e) => e) as ContractEvent[]
}

const startMigration = async () => {
  let isStopped = false
  let blocksFrom = START_BLOCK_NUMBER
  let blocksTo = START_BLOCK_NUMBER + BLOCKS_BATCH_SIZE - 1

  l.info('Retrieving all erc20 contracts data...')
  // const erc20Map = getTokensMapFromFile('src/cli/erc20_list.txt')
  // const erc721Map = getTokensMapFromFile('src/cli/erc721_list.txt')
  // const erc1155Map = getTokensMapFromFile('src/cli/erc1155_list.txt')
  const erc20Map = await getErc20Map()
  const erc721Map = await getErc721Map()
  const erc1155Map = await getErc1155Map()
  l.info(
    `Completed loading contracts data: erc20 ${Object.keys(erc20Map).length}, erc721 ${
      Object.keys(erc721Map).length
    }, erc1155 ${Object.keys(erc1155Map).length}`
  )

  const increaseBlocksNumber = () => {
    blocksFrom += BLOCKS_BATCH_SIZE
    blocksTo = blocksFrom + BLOCKS_BATCH_SIZE - 1
  }

  while (!isStopped) {
    try {
      console.time('get_logs')
      const logs = await getLogs(blocksFrom, blocksTo)
      console.timeEnd('get_logs')
      l.info(
        `Received ${logs.length} logs for blocks ${blocksFrom} - ${blocksTo} (${BLOCKS_BATCH_SIZE} blocks)`
      )
      if (blocksTo >= FINISH_BLOCK_NUMBER) {
        isStopped = true
      }

      if (logs.length === 0) {
        increaseBlocksNumber()
        await sleep(100)
        continue
      }

      const erc20Transfers = parseLogs(
        logs.filter((l) => !!erc20Map[l.address]),
        'erc20',
        ContractEventType.Transfer,
        erc20ABI
      )
      const erc20Approval = parseLogs(
        logs.filter((l) => !!erc20Map[l.address]),
        'erc20',
        ContractEventType.Approval,
        erc20ABI
      )
      const erc721Transfers = parseLogs(
        logs.filter((l) => !!erc721Map[l.address]),
        'erc721',
        ContractEventType.Transfer,
        erc721ABI
      )
      const erc721Approval = parseLogs(
        logs.filter((l) => !!erc721Map[l.address]),
        'erc721',
        ContractEventType.Approval,
        erc721ABI
      )
      const erc721ApprovalForAll = parseLogs(
        logs.filter((l) => !!erc721Map[l.address]),
        'erc721',
        ContractEventType.ApprovalForAll,
        erc721ABI
      )
      const erc1155Transfers = parseLogs(
        logs.filter((l) => !!erc1155Map[l.address]),
        'erc1155',
        ContractEventType.TransferSingle,
        erc1155ABI
      )
      const erc1155ApprovalForAll = parseLogs(
        logs.filter((l) => !!erc1155Map[l.address]),
        'erc1155',
        ContractEventType.ApprovalForAll,
        erc1155ABI
      )

      l.info(
        `Transfers: erc20: ${erc20Transfers.length}, erc721: ${erc721Transfers.length}, erc1155: ${erc1155Transfers.length},
        \nApprovals: erc20: ${erc20Approval.length}, erc721: ${erc721ApprovalForAll.length}, erc1155: ${erc1155ApprovalForAll.length}`
      )
      console.time('db_write')
      await writeContractEventsToDbBatch(erc20Transfers)
      await writeContractEventsToDbBatch(erc20Approval)
      await writeContractEventsToDbBatch(erc721Transfers)
      await writeContractEventsToDbBatch(erc721Approval)
      await writeContractEventsToDbBatch(erc721ApprovalForAll)
      await writeContractEventsToDbBatch(erc1155Transfers)
      await writeContractEventsToDbBatch(erc1155ApprovalForAll)
      console.timeEnd('db_write')

      await sleep(SUCCESS_SLEEP_TIMEOUT)

      increaseBlocksNumber()
    } catch (e) {
      l.error(`Migration error: ${e.message}, sleep`)
      process.exit(1)
      // await sleep(FAIL_SLEEP_TIMEOUT)
    }
  }
  l.info(`Migration completed on block ${blocksFrom}, exit`)
  process.exit(1)
}

;(async () => {
  await configInit()
  l.info(`Migrate Contract events task starting...`)
  startMigration()
})()
