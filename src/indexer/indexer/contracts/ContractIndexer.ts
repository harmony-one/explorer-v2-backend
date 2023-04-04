import {logger} from 'src/logger'
import LoggerModule from 'zerg/dist/LoggerModule'
import {stores} from 'src/store'
import {PostgresStorage} from 'src/store/postgres'
import nodeFetch from 'node-fetch'
import {
  Address,
  Contract,
  ContractEventType,
  ContractType,
  Filter,
  FilterEntry,
  IERC1155,
  IERC20,
  IERC721,
  IERC721TokenID,
  Log,
  ShardID,
} from 'src/types'
import {getByIPFSHash} from 'src/indexer/utils/ipfs'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {zeroAddress} from 'src/indexer/indexer/contracts/utils/zeroAddress'
import {config} from 'src/config'
import {ABIFactory as ABIFactoryERC1155} from 'src/indexer/indexer/contracts/erc1155/ABI'
import {ABIFactory as ABIFactoryERC721} from 'src/indexer/indexer/contracts/erc721/ABI'
import {ABIFactory as ABIFactoryERC20} from 'src/indexer/indexer/contracts/erc20/ABI'

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

const ERC20ExpectedMethods = [
  'Transfer',
  'Approval',
  'totalSupply',
  'decimals',
  'transfer',
  'balanceOf',
  'symbol',
  'name',
  'approve',
]

const ERC721ExpectedMethods = [
  'Transfer',
  'Approval',
  'totalSupply',
  'ownerOf',
  'tokenURI',
  'transferFrom',
  'safeTransferFrom',
  'balanceOf',
  'symbol',
  'name',
  'approve',
]

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

  private async addERC1155Contract(contract: Contract) {
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
        `Found new ERC1155 contract "${erc1155.name}" ${erc1155.address} at block ${contract.blockNumber}"`
      )
      return true
    } catch (e) {
      this.l.info(`Failed to get contract info`, e.message || e)
    }
  }

  private async addERC721Contract(contract: Contract) {
    const {hasAllSignatures, callAll} = ABIFactoryERC721(this.shardID)

    if (!hasAllSignatures(ERC721ExpectedMethods, contract.bytecode)) {
      return
    }

    try {
      const params = await callAll(this.shardID, contract.address, ['symbol', 'name'])
      const erc721: IERC721 = {
        address: contract.address,
        name: params.name.replaceAll('\u0000', ''),
        symbol: params.symbol.replaceAll('\u0000', ''),
        lastUpdateBlockNumber: contract.blockNumber,
      }

      await this.store.erc721.addERC721(erc721)
      this.l.info(
        `Found new ERC721 contract "${erc721.name}" ${erc721.address} at block ${contract.blockNumber}`
      )
      return true
    } catch (err) {
      this.l.debug(`Failed to get contract ${contract.address} info`, err.message || err)
      return false
    }
  }

  private async addERC20Contract(contract: Contract) {
    const {hasAllSignatures, callAll} = ABIFactoryERC20(this.shardID)
    if (!hasAllSignatures(ERC20ExpectedMethods, contract.bytecode)) {
      return
    }
    try {
      const params = await callAll(this.shardID, contract.address, ['symbol', 'name', 'decimals'])

      const erc20: IERC20 = {
        address: contract.address,
        decimals: +params.decimals,
        name: params.name.replaceAll('\u0000', ''),
        symbol: params.symbol.replaceAll('\u0000', ''),
        lastUpdateBlockNumber: contract.blockNumber,
      }

      await this.store.erc20.addERC20(erc20)
      this.l.info(
        `Found new ERC20 contract "${erc20.name}" ${erc20.address} at block ${contract.blockNumber}`
      )
      return true
    } catch (err) {
      this.l.debug(`Failed to get contract ${contract.address} info`, err.message || err)
      return
    }
  }

  private async addContract(contract: Contract) {
    if (this.contractType === 'erc1155') {
      return this.addERC1155Contract(contract)
    } else if (this.contractType === 'erc721') {
      return this.addERC721Contract(contract)
    } else if (this.contractType === 'erc20') {
      return this.addERC20Contract(contract)
    }
  }

  private async addContracts(contracts: Contract[]) {
    let count = 0
    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i]
      const isParsed = await this.addContract(contract)
      if (isParsed) {
        count++
      }
    }
    return count
  }

  private async parseEventsERC1155(logs: Log[]) {
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

  private async parseEventsERC721(logs: Log[]) {
    const {getEntryByName, decodeLog, call} = ABIFactoryERC721(this.shardID)
    const transferSignature = getEntryByName(ContractEventType.Transfer)!.signature
    const transferLogs = logs.filter(({topics}) => topics.includes(transferSignature))

    const addressesToUpdate = new Set<{
      address: string
      tokenAddress: string
      tokenId: string
      blockNumber: string
    }>()

    transferLogs.forEach((log) => {
      const {blockNumber} = log
      const [topic0, ...topics] = log.topics
      const decodedLog = decodeLog(ContractEventType.Transfer, log.data, topics)
      if (![decodedLog.from, decodedLog.to].includes(zeroAddress)) {
        const tokenAddress = normalizeAddress(log.address) as string
        const from = normalizeAddress(decodedLog.from) as string
        const to = normalizeAddress(decodedLog.to) as string
        const {tokenId} = decodedLog
        const value =
          typeof decodedLog.value !== 'undefined' ? BigInt(decodedLog.value).toString() : undefined

        addressesToUpdate.add({address: from, tokenAddress, tokenId, blockNumber})
        addressesToUpdate.add({address: to, tokenAddress, tokenId, blockNumber})
      }
    })

    for (const item of addressesToUpdate.values()) {
      const {address, tokenAddress, tokenId, blockNumber} = item
      await this.store.erc721.addAsset(address, tokenAddress, tokenId, blockNumber)
    }
    return transferLogs.length
  }

  private async parseEventsERC20(logs: Log[]) {
    const {getEntryByName, decodeLog} = ABIFactoryERC20(this.shardID)
    const transferSignature = getEntryByName(ContractEventType.Transfer)!.signature
    const transferLogs = logs.filter(({topics}) => topics.includes(transferSignature))

    if (transferLogs.length > 0) {
      const addressesToUpdate = new Set<{address: string; tokenAddress: string}>() // unique addresses of senders and recipients
      transferLogs.forEach((log) => {
        const [topic0, ...topics] = log.topics
        const decodedLog = decodeLog(ContractEventType.Transfer, log.data, topics)
        const tokenAddress = normalizeAddress(log.address) as string
        const from = normalizeAddress(decodedLog.from) as string
        const to = normalizeAddress(decodedLog.to) as string

        if (from !== zeroAddress) {
          addressesToUpdate.add({address: from, tokenAddress})
        }
        if (to !== zeroAddress) {
          addressesToUpdate.add({address: to, tokenAddress})
        }
      })

      const updateBalancesPromises = [
        ...addressesToUpdate.values(),
      ].map(({address, tokenAddress}) =>
        this.store.erc20.setNeedUpdateBalance(address, tokenAddress)
      )
      await Promise.all(updateBalancesPromises)
    }
    return transferLogs.length
  }

  private async parseEvents(logs: Log[]) {
    if (this.contractType === 'erc1155') {
      return this.parseEventsERC1155(logs)
    } else if (this.contractType === 'erc721') {
      return this.parseEventsERC721(logs)
    } else if (this.contractType === 'erc20') {
      return this.parseEventsERC20(logs)
    }
  }

  private async updateMetadata() {
    if (this.contractType === 'erc1155') {
      return this.updateMetadataERC1155()
    } else if (this.contractType === 'erc721') {
      return this.updateMetadataERC721()
    } else if (this.contractType === 'erc20') {
      return this.updateMetadataERC20()
    }
  }

  private async updateMetadataERC20() {
    const {call} = ABIFactoryERC20(this.shardID)
    let count = 0
    const tokensForUpdate = new Set<Address>()

    // since we update entries, iterator doesnt work
    while (true) {
      const balancesNeedUpdate = await this.store.erc20.getBalances({
        ...updateTokensFilter,
        limit: 100,
      })
      if (!balancesNeedUpdate.length) {
        break
      }

      const promises = balancesNeedUpdate.map(({ownerAddress, tokenAddress}) => {
        tokensForUpdate.add(tokenAddress)

        return call('balanceOf', [ownerAddress], tokenAddress).then((balance) =>
          this.store.erc20.updateBalance(ownerAddress, tokenAddress, balance)
        )
      })
      await Promise.all(promises)
      count += balancesNeedUpdate.length
    }

    const promises = [...tokensForUpdate.values()].map(async (token) => {
      const holders = await this.store.erc20.getHoldersCount(token)
      const totalSupply = await call('totalSupply', [], token)
      const circulatingSupply = await this.store.erc20.getERC20CirculatingSupply(token)

      const erc20 = {
        holders: +holders || 0,
        totalSupply: totalSupply,
        circulatingSupply,
        transactionCount: 0,
        address: token,
      }

      // @ts-ignore
      return this.store.erc20.updateERC20(erc20)
    })

    await Promise.all(promises)
    return count
  }

  private async updateMetadataERC721() {
    const {call} = ABIFactoryERC721(this.shardID)

    let count = 0
    const tokensForUpdate = new Set<Address>()

    // since we update entries, iterator doesnt work
    while (true) {
      const assetsNeedUpdate = await this.store.erc721.getAssets(updateTokensFilter)
      if (!assetsNeedUpdate.length) {
        break
      }

      const promises = assetsNeedUpdate.map(async ({tokenAddress, tokenID, meta: metaData}) => {
        tokensForUpdate.add(tokenAddress)

        // todo dont fetch uri if already there
        const uri = await call('tokenURI', [tokenID], tokenAddress)

        const owner = await call('ownerOf', [tokenID], tokenAddress).then(normalizeAddress)
        let meta = {} as any
        if (!metaData || Object.keys(metaData).length == 0) {
          try {
            // todo validate size
            meta = await nodeFetch(uri).then((r) => r.json())
          } catch (e) {
            // l.warn(`Failed to fetch meta from ${uri} for token ${tokenAddress} ${tokenID}`)
          }
        }

        return this.store.erc721.updateAsset(
          owner!,
          tokenAddress,
          uri,
          meta,
          tokenID as IERC721TokenID
        )
      })
      await Promise.all(promises)
      count += assetsNeedUpdate.length
    }

    const promises = [...tokensForUpdate.values()].map(async (token) => {
      const holders = await this.store.erc721.getHoldersCount(token)
      const totalSupply = await call('totalSupply', [], token)
      // todo tx count ?

      const erc721 = {
        holders: +holders || 0,
        totalSupply: totalSupply,
        transactionCount: 0,
        address: token,
      }

      // @ts-ignore
      return this.store.erc721.updateERC721(erc721)
    })

    await Promise.all(promises)
    return count
  }

  private async updateMetadataERC1155() {
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
    if (this.contractType === 'erc1155') {
      return this.updateBalancesERC1155()
    }
    return 0
  }

  private async updateBalancesERC1155() {
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

    const blocksRange = 1000
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
      this.l.info(`Wait`)
      sleepTimeout = 1000 * 5
    }

    setTimeout(this.loop, sleepTimeout)
  }
}
