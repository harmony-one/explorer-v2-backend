import {storesAPI as stores} from 'src/store'
import {ShardID, IERC20, IERC20Balance, Address, ContractEventType} from 'src/types/blockchain'
import {withCache} from 'src/api/controllers/cache'
import {validator} from 'src/utils/validators/validators'
import {isAddress, isShard, isOffset, isLimit} from 'src/utils/validators'
import {getTransactionByHash} from 'src/indexer/rpc/client'
import * as RPCClient from 'src/indexer/rpc/client'
import {ABIFactory as ABIFactoryERC20} from 'src/indexer/indexer/contracts/erc20/ABI'

export async function getAllERC20(shardID: ShardID): Promise<IERC20[] | null> {
  validator({
    shardID: isShard(shardID),
  })

  return await withCache(
    [shardID, 'getAllERC20', arguments],
    () => stores[shardID].erc20.getAllERC20(),
    1000 * 60 * 60
  )
}

export async function getUserERC20Balances(
  shardID: ShardID,
  address: Address
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
  })

  return await withCache(
    [shardID, 'getAllERC20', arguments],
    () => stores[shardID].erc20.getUserBalances(address),
    1000 * 60 * 60
  )
}

export async function getERC20TokenHolders(
  shardID: ShardID,
  address: Address,
  limit = 100,
  offset = 0
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
    offset: isOffset(offset),
    limit: isLimit(limit),
  })

  return await withCache(
    [shardID, 'getERC20TokenHolders', arguments],
    () => stores[shardID].erc20.getHolders(address, limit, offset),
    1000 * 60 * 60
  )
}

const getERC20Transfer = async (txHash: string) => {
  const shardID = 0
  const tx = await getTransactionByHash(shardID, txHash)

  if (!tx) {
    throw new Error('Tx not found')
  }

  const blockNumber = Number(tx.blockNumber)
  const fromBlock = blockNumber
  const toBlock = blockNumber
  const logs = await RPCClient.getLogs(shardID, fromBlock, toBlock)

  if (logs.length === 0) {
    throw new Error('Logs not found')
  }

  const {call, getEntryByName, decodeLog} = ABIFactoryERC20(shardID)
  const transferSignature = getEntryByName(ContractEventType.Transfer)!.signature
  const transferLogs = logs.filter(({topics}) => topics.includes(transferSignature))

  if (transferLogs.length === 0) {
    throw new Error('Transfer logs not found')
  }

  let address = ''
  let from = ''
  let to = ''
  let value = ''
  let decimals = '0'
  let valueFormatted = 0

  const [log] = transferLogs

  if (log) {
    const [topic0, ...topics] = log.topics
    const decodedLog = decodeLog(ContractEventType.Transfer, log.data, topics)
    address = log.address
    from = decodedLog.from
    to = decodedLog.to
    value = decodedLog.value

    decimals = await call('decimals', [], log.address)
    valueFormatted = +value / Math.pow(10, +decimals)
  }

  return {
    txHash,
    address,
    from,
    to,
    value,
    decimals,
    valueFormatted,
  }
}

export async function getERC20TransferInfo(
  shardID: ShardID,
  txHash: string
): Promise<IERC20Balance[] | null> {
  return await withCache(
    [shardID, 'getERC20TokenHolders', arguments],
    () => getERC20Transfer(txHash),
    1000 * 10
  )
}
