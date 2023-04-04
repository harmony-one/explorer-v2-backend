import {logger} from 'src/logger'
import LoggerModule from 'zerg/dist/LoggerModule'
import {stores} from 'src/store'
import {PostgresStorage} from 'src/store/postgres'
import {
  Address,
  Contract,
  ContractEventType,
  ContractType,
  Filter,
  FilterEntry,
  IERC1155,
  IERC721TokenID,
  Log,
  ShardID,
} from 'src/types'
import {ABIFactory as ABIFactoryERC1155} from 'src/indexer/indexer/contracts/erc1155/ABI'
import {getByIPFSHash} from 'src/indexer/utils/ipfs'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {config} from 'src/config'

const updateTokensFilter: Filter = {
  limit: 10,
  offset: 0,
  filters: [
    {
      property: 'needUpdate',
      type: 'eq',
      value: 'true',
    },
  ],
}

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
  readonly contractType: ContractType
  readonly shardID: ShardID

  constructor(shardID: ShardID, contractType: ContractType) {
    this.shardID = shardID
    this.contractType = contractType
    this.store = stores[shardID]
    this.l = logger(module, `:Shard ${shardID} ${contractType}`)
  }

  private async parseContract(contract: Contract) {
    const {hasAllSignatures, callAll} = ABIFactoryERC1155(this.shardID)

    if (!hasAllSignatures(ERC1155ExpectedMethods, contract.bytecode)) {
      return
    }

    let contractName = 'HRC1155'
    let contractSymbol = 'HRC1155'
    let meta: Record<string, string> = {}

    try {
      const params = await callAll(this.shardID, contract.address, ['contractURI'])
      if (params.contractURI) {
        try {
          const metadata = await getByIPFSHash(params.contractURI)
          meta = {...metadata}
          if (metadata.name) {
            contractName = metadata.name.replaceAll('\u0000', '')
            meta.name = contractName
          }
          if (metadata.symbol) {
            contractSymbol = metadata.symbol.replaceAll('\u0000', '')
            meta.symbol = contractSymbol
          }
        } catch (e) {
          this.l.info(
            `Cannot get metadata for contract ${contract.address}, uri "${params.contractURI}"`,
            e.message
          )
        }
      }

      const erc1155: IERC1155 = {
        address: contract.address,
        name: contractName,
        symbol: contractSymbol,
        lastUpdateBlockNumber: contract.blockNumber,
        meta: JSON.stringify(meta),
        contractURI: params.contractURI,
      }
      await this.store.erc1155.addERC1155(erc1155)
      this.l.info(
        `Block ${contract.blockNumber}: found new ERC1155 contract ${erc1155.address}, name: "${erc1155.name}"`
      )
      return erc1155
    } catch (e) {
      this.l.info(`Failed to get contract info`, e.message || e)
    }
  }

  private async addContracts(contracts: Contract[]) {
    let count = 0
    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i]
      const parsed = await this.parseContract(contract)

      if (parsed) {
        count++
      }
    }
    return count
  }

  private async parseEvents(logs: Log[]) {
    const addressesToUpdate = new Set<{
      address: string
      tokenAddress: string
      tokenId: string
      blockNumber: string
    }>()
    const {decodeLog, getEntryByName} = ABIFactoryERC1155(this.shardID)
    const transferSingleEvent = getEntryByName(ContractEventType.TransferSingle)!.signature

    const transferSingleLogs = logs.filter(({topics}) => topics.includes(transferSingleEvent))

    transferSingleLogs.forEach((log) => {
      const {blockNumber} = log
      const [topic0, ...topics] = log.topics
      const decodedLog = decodeLog(ContractEventType.TransferSingle, log.data, topics)
      if (decodedLog) {
        const {id: tokenId} = decodedLog
        const tokenAddress = normalizeAddress(log.address) as string
        const from = normalizeAddress(decodedLog.from) as string
        const to = normalizeAddress(decodedLog.to) as string
        if (from !== zeroAddress) {
          addressesToUpdate.add({address: from, tokenAddress, tokenId, blockNumber})
        }
        if (to !== zeroAddress) {
          addressesToUpdate.add({address: to, tokenAddress, tokenId, blockNumber})
        }
      }
    })

    for (const item of addressesToUpdate.values()) {
      const {address, tokenAddress, tokenId, blockNumber} = item
      await this.store.erc1155.addAsset(tokenAddress, tokenId, blockNumber)
      await this.store.erc1155.setNeedUpdateBalance(address, tokenAddress, tokenId)
    }
    return transferSingleLogs.length
  }

  private async updateMetadata() {
    const {call} = ABIFactoryERC1155(this.shardID)

    let count = 0
    const tokensForUpdate = new Set<Address>()

    while (true) {
      const assetsNeedUpdate = await this.store.erc1155.getAssets(updateTokensFilter)
      if (!assetsNeedUpdate.length) {
        break
      }
      // this.l.info(`Updating ${assetsNeedUpdate.length} assets`)

      const promises = assetsNeedUpdate.map(
        async ({meta: metaData, tokenAddress, tokenID, tokenURI = ''}) => {
          // todo dont fetch meta if already there
          // @ts-ignore
          if (metaData && metaData.name) {
            // todo tmp line
            await this.store.erc1155.updateAsset(
              tokenAddress,
              tokenURI,
              metaData,
              tokenID as IERC721TokenID
            )
            return
          }

          tokensForUpdate.add(tokenAddress)

          const uri = await call('uri', [tokenID], tokenAddress)
          let meta = {} as any

          try {
            meta = await getByIPFSHash(uri)
          } catch (e) {
            this.l.debug(
              `Failed to fetch metadata from ${uri} for token ${tokenAddress} ${tokenID}`
            )
          }

          await this.store.erc1155.updateAsset(tokenAddress, uri, meta, tokenID as IERC721TokenID)
        }
      )
      await Promise.all(promises)
      count += assetsNeedUpdate.length
    }

    return count
  }

  private async updateBalances() {
    const {call} = ABIFactoryERC1155(this.shardID)

    const tokensForUpdate = new Set<Address>()
    let count = 0

    while (true) {
      const assetsNeedUpdate = await this.store.erc1155.getBalances(updateTokensFilter)
      if (!assetsNeedUpdate.length) {
        break
      }

      const promises = assetsNeedUpdate.map(async ({tokenAddress, tokenID, ownerAddress}) => {
        tokensForUpdate.add(tokenAddress)

        const [balance] = await call('balanceOfBatch', [[ownerAddress], [tokenID]], tokenAddress)
        count++
        return this.store.erc1155.updateBalance(
          tokenAddress,
          ownerAddress,
          tokenID as IERC721TokenID,
          balance
        )
      })
      await Promise.all(promises)
    }

    return count
  }

  private async getAllContractAddresses(): Promise<Array<{address: string}>> {
    return await this.store.query(`select address from ${this.contractType}`, [])
  }

  loop = async () => {
    const initialHeight = config.indexer.initialBlockSyncingHeight
    const contractsIndexerHeight =
      (await this.store.indexer.getLastIndexedBlockNumberByName(
        `${this.contractType}_contracts`
      )) || initialHeight
    const blocksHeight = (await this.store.indexer.getLastIndexedBlockNumber()) || initialHeight
    // const logsHeight = await this.store.indexer.getLastIndexedBlockNumberByName('logs')

    const blocksRange = 10
    const blocksThreshold = 30

    const blocksHeightLimit = blocksHeight - blocksThreshold

    const blocksFrom = contractsIndexerHeight + 1
    const blocksTo = Math.min(blocksFrom + blocksRange - 1, blocksHeightLimit)
    const delta = blocksTo - blocksFrom

    let sleepTimeout = 100
    if (delta >= 0) {
      const baseFilters: FilterEntry[] = [
        {
          property: 'block_number',
          type: 'gte',
          value: blocksFrom,
        },
        {
          property: 'block_number',
          type: 'lte',
          value: blocksTo,
        },
      ]

      const contracts = await this.store.contract.getContracts({filters: baseFilters})
      const logs = await this.store.log.getLogs({filters: baseFilters})

      const contractsCount = await this.addContracts(contracts)

      const contractAddresses = await this.getAllContractAddresses()
      const contractsLogs = logs.filter((log) =>
        contractAddresses.find(({address}) => address === log.address)
      )
      const eventsCount = await this.parseEvents(contractsLogs)

      const metadataUpdateCount = await this.updateMetadata()
      const balancesUpdateCount = await this.updateBalances()

      await this.store.indexer.setLastIndexedBlockNumberByName(
        `${this.contractType}_contracts`,
        blocksTo
      )

      this.l.info(
        `Processed blocks [${blocksFrom}, ${blocksTo}] (${
          delta + 1
        } blocks). ${contractsCount} contracts, ${eventsCount} events. Updated ${metadataUpdateCount} metadata, ${balancesUpdateCount} address balances.`
      )
    } else {
      sleepTimeout = 1000 * 5
    }

    setTimeout(this.loop, sleepTimeout)
  }
}
