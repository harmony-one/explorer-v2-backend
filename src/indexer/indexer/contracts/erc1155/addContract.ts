import {Contract, IERC1155} from 'src/types'
import {validator, isUint, isLength} from 'src/utils/validators/validators'
import {logger} from 'src/logger'
import {PostgresStorage} from 'src/store/postgres'
import {ABI} from './ABI'
import {getByIPFSHash} from 'src/indexer/utils/ipfs/index'

const {hasAllSignatures, callAll} = ABI
const l = logger(module, 'erc1155')

// https://eips.ethereum.org/EIPS/eip-20
const expectedMethodsAndEvents = [
  'TransferSingle',
  'TransferBatch',
  // 'totalSupply',
  'owner',
  'tokenURIPrefix',
  'balanceOfBatch',
  'contractURI',
]

const callableMethods = ['contractURI'] // ['symbol', 'name']
const maxMetaLength = 20000

const initialMeta = {
  name: 'HRC1155',
  symbol: 'HRC1155',
}

const initialEmptyMeta = JSON.stringify({})

export const addContract = async (store: PostgresStorage, contract: Contract) => {
  if (!hasAllSignatures(expectedMethodsAndEvents, contract.bytecode)) {
    return
  }

  let params: Record<typeof callableMethods[number], string>
  let meta = initialMeta
  let metaJSON = initialEmptyMeta

  try {
    params = await callAll(contract.address, callableMethods)

    const prepareMeta = async () => {
      meta = (await getByIPFSHash(params.contractURI)) || initialMeta
      metaJSON = meta ? JSON.stringify(meta) : initialEmptyMeta

      if (metaJSON && metaJSON.length > maxMetaLength) {
        // don't store big meta
        metaJSON = initialEmptyMeta
      }

      validator({
        name: () => isLength(meta.name, {min: 3, max: 64}),
        symbol: () => isLength(meta.symbol, {min: 3, max: 24}),
      })
    }

    if (params.contractURI && params.contractURI.length === 46) {
      await prepareMeta()
    }
  } catch (err) {
    l.debug(`Failed to get contract ${contract.address} info`, err.message || err)
    return
  }

  const erc1155: IERC1155 = {
    address: contract.address,
    name: meta.name.replaceAll('\u0000', ''),
    symbol: meta.symbol.replaceAll('\u0000', ''),
    lastUpdateBlockNumber: contract.blockNumber,
    meta: metaJSON,
    contractURI: params.contractURI,
  }

  l.info(`Found new contract "${erc1155.name}" at ${contract.blockNumber}`)

  await store.erc1155.addERC1155(erc1155)
}
