import {Address, ByteCode, Contract, IERC20} from 'src/types'
import {validator, isUint, isLength} from 'src/utils/validators/validators'
import {logger} from 'src/logger'
import {PostgresStorage} from 'src/store/postgres'
import {ABI} from './ABI'

const {hasAllSignatures, callAll} = ABI
const l = logger(module, 'erc20')

// https://eips.ethereum.org/EIPS/eip-20
const expectedMethodsAndEvents = [
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

const callableMethods = ['symbol', 'name', 'decimals']

export const addContract = async (store: PostgresStorage, contract: Contract) => {
  if (!hasAllSignatures(expectedMethodsAndEvents, contract.bytecode)) {
    return
  }

  let params: Record<typeof callableMethods[number], string>

  try {
    params = await callAll(contract.address, callableMethods)

    validator({
      decimals: () => isUint(+params.decimals),
      name: () => isLength(params.name, {min: 3, max: 64}),
      symbol: () => isLength(params.symbol, {min: 3, max: 10}),
    })
  } catch (err) {
    l.debug(`Failed to get contract ${contract.address} info`, err.message || err)
    return
  }

  const erc20: IERC20 = {
    address: contract.address,
    decimals: +params.decimals,
    name: params.name,
    symbol: params.symbol,
    lastUpdateBlockNumber: contract.blockNumber,
  }
  l.info(`Found new contract "${erc20.name}" at ${contract.blockNumber}`)

  await store.erc20.addERC20(erc20)
}
