/*
 * Contract Events migrator
 * Workflow:
 * 1) get all erc20, 721, 1155 contract addresses from DB
 * 2) get logs with given blocks range
 * 3) filter logs with contract addresses from step 1, parse with event type (Transfer, TransferSingle)
 * 4) write parsed events to table 'contract_events'
 * 4) goto step 2, repeat
 * */

import {init as configInit} from 'src/config'
import {ContractEvent, ContractEventType, ContractType, Log} from 'src/types'
import {logger} from 'src/logger'
import {stores} from 'src/store'
import {ABI as erc20ABI} from 'src/indexer/indexer/contracts/erc20/ABI'
import {ABI as erc721ABI} from 'src/indexer/indexer/contracts/erc721/ABI'
import {ABI as erc1155ABI} from 'src/indexer/indexer/contracts/erc1155/ABI'
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {normalizeAddress} from 'src/utils/normalizeAddress'

const l = logger(module, `ContractEventsMigrator`)

const SHARD_ID = 0
const START_BLOCK_NUMBER = 5000000
const FINISH_BLOCK_NUMBER = 30000000
const BLOCKS_BATCH_SIZE = 1000

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

const mapContractEvent = (
  log: Log,
  tokenAddress: string,
  contractType: ContractType,
  eventType: ContractEventType,
  abi: any
) => {
  const {decodeLog} = abi
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
      transactionType: contractType,
      eventType: ContractEventType.Transfer,
    } as ContractEvent
  }
}

const writeContractEventsToDb = async (events: ContractEvent[]) => {
  const store = stores[SHARD_ID]
  console.time('db_write')
  await Promise.all(events.map((e) => store.contract.addContractEvent(e)))
  console.timeEnd('db_write')
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
  const tokenAddress = filteredLogs[0].address
  return filteredLogs
    .map((log) => {
      try {
        return mapContractEvent(log, tokenAddress, contractType, eventType, abi)
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
      const logs = await getLogs(blocksFrom, blocksTo)
      l.info(
        `Received ${logs.length} logs for blocks ${blocksFrom} - ${blocksTo} (${BLOCKS_BATCH_SIZE} blocks)`
      )
      if (blocksTo >= FINISH_BLOCK_NUMBER) {
        isStopped = true
      }

      if (logs.length === 0) {
        increaseBlocksNumber()
        continue
      }

      const erc20Transfers = parseLogs(
        logs.filter((l) => !!erc20Map[l.address]),
        'erc20',
        ContractEventType.Transfer,
        erc20ABI
      )
      const erc721Transfers = parseLogs(
        logs.filter((l) => !!erc721Map[l.address]),
        'erc721',
        ContractEventType.Transfer,
        erc721ABI
      )
      const erc1155Transfers = parseLogs(
        logs.filter((l) => !!erc1155Map[l.address]),
        'erc1155',
        ContractEventType.TransferSingle,
        erc1155ABI
      )

      l.info(
        `Found events: erc20: ${erc20Transfers.length}, erc721: ${erc721Transfers.length}, erc1155: ${erc1155Transfers.length}`
      )

      await writeContractEventsToDb(erc20Transfers)

      await sleep(500)

      increaseBlocksNumber()
    } catch (e) {
      l.error(`Migration error: ${e.message}, sleep`)
      await sleep(10000)
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
