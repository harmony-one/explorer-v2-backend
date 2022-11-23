import {Contract, IERC721} from 'src/types'
import {validator, isUint, isLength} from 'src/utils/validators/validators'
import {logger} from 'src/logger'
import {PostgresStorage} from 'src/store/postgres'
import {ABIFactory} from './ABI'

const l = logger(module, 'erc721')

// https://eips.ethereum.org/EIPS/eip-20
const expectedMethodsAndEvents = [
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

const callableMethods = ['symbol', 'name']

export const addContract = async (store: PostgresStorage, contract: Contract) => {
  const {hasAllSignatures, callAll} = ABIFactory(store.shardID)

  if (!hasAllSignatures(expectedMethodsAndEvents, contract.bytecode)) {
    return
  }

  let params: Record<typeof callableMethods[number], string>

  try {
    params = await callAll(store.shardID, contract.address, callableMethods)

    validator({
      name: () => isLength(params.name, {min: 3, max: 64}),
      symbol: () => isLength(params.symbol, {min: 3, max: 24}),
    })
  } catch (err) {
    l.debug(`Failed to get contract ${contract.address} info`, err.message || err)
    return
  }

  const erc721: IERC721 = {
    address: contract.address,
    name: params.name.replaceAll('\u0000', ''),
    symbol: params.symbol.replaceAll('\u0000', ''),
    lastUpdateBlockNumber: contract.blockNumber,
  }
  l.info(`Found new contract "${erc721.name}" at ${contract.blockNumber}`)

  await store.erc721.addERC721(erc721)
}
