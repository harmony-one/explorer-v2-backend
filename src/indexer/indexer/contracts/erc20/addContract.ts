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

const AdminChangedSignature = '0x7e644d79' // AdminChanged(address,address)
const InitializeSignatures = ['0x8129fc1c', '0xfe4b84d'] // initialize(), initialize(uint256)

const getProxyAddress = async (store: PostgresStorage, erc20: IERC20) => {
  const {address: implAddress, name} = erc20
  const internalTxs = await store.internalTransaction.getInternalTransactions({
    filters: [
      {
        type: 'eq',
        property: 'to',
        value: `'${implAddress}'`,
      },
    ],
  })
  const firstDelegateCall = internalTxs.find(
    (tx) =>
      tx.type === 'delegatecall' &&
      InitializeSignatures.includes(tx.input.toLowerCase().substring(0, 10))
  )
  if (firstDelegateCall) {
    const {from: proxyAddress, transactionHash} = firstDelegateCall
    const logs = await store.log.getLogsByField('transaction_hash', transactionHash)
    const logAdminChanged = logs.find((log) =>
      log.topics.find((topic) => topic.includes(AdminChangedSignature))
    )
    if (logAdminChanged) {
      return proxyAddress
    }
  }
}

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
      symbol: () => isLength(params.symbol, {min: 3, max: 24}),
    })
  } catch (err) {
    l.debug(`Failed to get contract ${contract.address} info`, err.message || err)
    return
  }

  const erc20: IERC20 = {
    address: contract.address,
    decimals: +params.decimals,
    name: params.name.replaceAll('\u0000', ''),
    symbol: params.symbol.replaceAll('\u0000', ''),
    lastUpdateBlockNumber: contract.blockNumber,
  }

  await store.erc20.addERC20(erc20)
  l.info(`Found new contract "${erc20.name}" at ${contract.blockNumber}`)

  // const proxyAddress = await getProxyAddress(store, erc20)
  // if (proxyAddress) {
  //   await store.contract.assignProxyImplementation(proxyAddress, erc20.address)
  //   await store.erc20.addERC20({
  //     ...erc20,
  //     address: proxyAddress,
  //   })
  //   l.info(
  //     `Found proxy contract: "${proxyAddress}", implementation address: "${erc20.address}" ("${erc20.name}")`
  //   )
  // }
}
