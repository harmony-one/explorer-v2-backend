import {logger} from 'src/logger'
import LoggerModule from 'zerg/dist/LoggerModule'
import {stores} from 'src/store'
import {PostgresStorage} from 'src/store/postgres'
import {
  Contract,
  ContractEventType,
  ContractType,
  FilterEntry,
  IERC1155,
  Log,
  ShardID,
} from 'src/types'
import {ABIFactory as ABIFactoryERC1155} from 'src/indexer/indexer/contracts/erc1155/ABI'
import {ABIFactory as ABIFactoryERC721} from 'src/indexer/indexer/contracts/erc721/ABI'
import {ABIFactory as ABIFactoryERC20} from 'src/indexer/indexer/contracts/erc20/ABI'
import {getByIPFSHash} from 'src/indexer/utils/ipfs'
import {normalizeAddress} from 'src/utils/normalizeAddress'

const syncingIntervalMs = 1000 * 30

const ERC1155ExpectedMethods = [
  'TransferSingle',
  'TransferBatch',
  'owner',
  'balanceOfBatch',
  'contractURI',
]

export class ContractIndexer {
  readonly l: LoggerModule
  readonly store: PostgresStorage
  readonly contractType: string
  readonly shardID: ShardID

  constructor(shardID: ShardID, contractType: ContractType) {
    this.shardID = shardID
    this.contractType = contractType
    this.store = stores[shardID]
    this.l = logger(module, `:Shard ${shardID} ${contractType}`)
  }

  private sleep(timeout: number) {
    return new Promise((resolve) => setTimeout(resolve, timeout))
  }

  private async parseERC1155(contract: Contract) {
    const {hasAllSignatures, callAll} = ABIFactoryERC1155(this.shardID)

    if (!hasAllSignatures(ERC1155ExpectedMethods, contract.bytecode)) {
      return
    }

    let meta = {
      name: 'HRC1155',
      symbol: 'HRC1155',
    }
    let metaJSON = JSON.stringify({})

    try {
      const params = await callAll(this.shardID, contract.address, ['contractURI'])
      if (params.contractURI) {
        try {
          meta = await getByIPFSHash(params.contractURI)
          meta.name = meta.name.replaceAll('\u0000', '')
          meta.symbol = meta.symbol.replaceAll('\u0000', '')
          metaJSON = JSON.stringify(meta)
        } catch (e) {
          this.l.info(
            `Cannot get metadata for contract ${contract.address}, uri "${params.contractURI}"`,
            e.message
          )
        }
      }

      const erc1155: IERC1155 = {
        address: contract.address,
        name: meta.name,
        symbol: meta.symbol,
        lastUpdateBlockNumber: contract.blockNumber,
        meta: metaJSON,
        contractURI: params.contractURI,
      }
      // await this.store.erc1155.addERC1155(erc1155)

      this.l.info(`Found new ERC1155 contract "${erc1155.name}" at block ${contract.blockNumber}`)
      return erc1155
    } catch (e) {
      this.l.info(`Failed to get contract info`, e.message || e)
    }
  }

  private async addContracts(contracts: Contract[]) {
    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i]
      const erc1155 = await this.parseERC1155(contract)
    }
  }

  private async parseEventsErc1155(logs: Log[]) {
    const contracts = await this.store.erc1155.getAllERC1155()
    const erc1155Logs = logs.filter((log) =>
      contracts.find((contract) => contract.address === log.address)
    )
    const addressesToUpdate = new Set<{
      address: string
      tokenAddress: string
      tokenId: string
      blockNumber: string
    }>()
    const {decodeLog, getEntryByName} = ABIFactoryERC1155(this.shardID)
    const transferSingleEvent = getEntryByName(ContractEventType.TransferSingle)!.signature

    const transferSingleLogs = erc1155Logs.filter(({topics}) =>
      topics.includes(transferSingleEvent)
    )

    transferSingleLogs.forEach((log) => {
      const {blockNumber} = log
      const [topic0, ...topics] = log.topics
      const decodedLog = decodeLog(ContractEventType.TransferSingle, log.data, topics)
      if (decodedLog) {
        const {id: tokenId} = decodedLog
        const tokenAddress = normalizeAddress(log.address) as string
        const from = normalizeAddress(decodedLog.from) as string
        const to = normalizeAddress(decodedLog.to) as string
        if (from) {
          addressesToUpdate.add({address: from, tokenAddress, tokenId, blockNumber})
        }
        if (to) {
          addressesToUpdate.add({address: to, tokenAddress, tokenId, blockNumber})
        }
      }
    })
  }

  private async parseEvents(logs: Log[]) {
    await this.parseEventsErc1155(logs)
  }

  loop = async () => {
    const startBlockNumber = 39534690
    const blocksRange = 1000

    const baseFilters: FilterEntry[] = [
      {
        property: 'block_number',
        type: 'gte',
        value: startBlockNumber,
      },
      {
        property: 'block_number',
        type: 'lt',
        value: startBlockNumber + blocksRange,
      },
    ]

    const contracts = await this.store.contract.getContracts({filters: baseFilters})

    // todo only when blocks synced
    // const currentLogsHeight = await this.store.indexer.getLastIndexedBlockNumberByName('logs')
    const logs = await this.store.log.getLogs({filters: baseFilters})

    await this.addContracts(contracts)
    await this.parseEvents(logs)
    await this.sleep(syncingIntervalMs)
  }
}
