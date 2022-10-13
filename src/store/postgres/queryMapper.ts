import {Log} from 'src/types'

export const mapNaming: Record<string, string> = {
  extra_data: 'extraData',
  gas_limit: 'gasLimit',
  gas_used: 'gasUsed',
  gas_price: 'gasPrice',
  logs_bloom: 'logsBloom',
  mix_hash: 'mixHash',
  parent_hash: 'parentHash',
  receipts_root: 'receiptsRoot',
  sha3_uncles: 'sha3Uncles',
  state_root: 'stateRoot',
  staking_transactions: 'stakingTransactions',
  transactions_root: 'transactionsRoot',
  view_id: 'viewID',
  to_shard_id: 'toShardID',
  transaction_index: 'transactionIndex',
  block_number: 'blockNumber',
  block_hash: 'blockHash',
  transaction_hash: 'transactionHash',
  log_index: 'logIndex',
  shard: 'shardID',
  transaction_type: 'transactionType',
  parent_id: 'parentId',
  creator_address: 'creatorAddress',
  solidity_version: 'solidityVersion',
  total_supply: 'totalSupply',
  circulating_supply: 'circulatingSupply',
  owner_address: 'ownerAddress',
  token_address: 'tokenAddress',
  need_update: 'needUpdate',
  transaction_count: 'transactionCount',
  token_id: 'tokenID',
  '"from"': 'from',
  '"to"': 'to',
  internal_transactions: 'internalTransactions',
  ipfs_hash: 'IPFSHash',
  last_update_block_number: 'lastUpdateBlockNumber',
  token_uri: 'tokenURI',
  extra_mark: 'extraMark',
  event_type: 'eventType',
  implementation_address: 'implementationAddress',
  updated_at: 'updatedAt',
}

export const mapNamingReverse: Record<string, string> = Object.keys(mapNaming).reduce((a, k) => {
  a[mapNaming[k]] = k
  return a
}, {} as Record<string, string>)

const fromHexToNumber = (s: string | number) =>
  s ? (typeof s === 'number' ? s : BigInt(s).toString()) : s
const fromStringToNumber = (s: string | number) => +s

const toStoreMappers: Record<string, (val: any) => any> = {
  gasLimit: fromHexToNumber,
  gasUsed: fromHexToNumber,
  epoch: fromHexToNumber,
  difficulty: fromHexToNumber,
  nonce: fromHexToNumber,
  size: fromHexToNumber,
  logIndex: fromHexToNumber,
  transactionIndex: fromHexToNumber,
  timestamp: (t) => new Date(parseInt(t, 16) * 1000),
}

export const fromSnakeToCamelResponse = (o: Record<any, any>) => {
  return Object.keys(o).reduce((newO: any, key) => {
    const newKey: string = mapNaming[key] || key
    newO[newKey] = o[key]
    return newO
  }, {})
}

export const generateQuery = (o: Record<any, any>) => {
  const filteredKeys = Object.keys(o).filter((k) => o[k] !== undefined)

  const fields = filteredKeys.map((k) => mapNamingReverse[k] || k).join(',')
  const placeholders = filteredKeys.map((_, i) => `$${i + 1}`).join(',')

  const query = `(${fields}) values(${placeholders})`
  const params = filteredKeys.map((k) => {
    if (toStoreMappers[k]) {
      return toStoreMappers[k](o[k])
    }
    return o[k]
  })

  return {
    query,
    params,
  }
}

const intToHex = (value: string | number) => '0x' + (+value).toString(16)

export const mapLogToEthLog = (log: Log) => {
  return {
    ...log,
    blockNumber: intToHex(log.blockNumber),
    transactionIndex: intToHex(log.transactionIndex),
    logIndex: intToHex(log.logIndex),
  }
}

type QueryReducerArray = [string, any[], number]

export function queryParamsConvert(parameterizedSql: string, params: Record<string, any>) {
  const [text, values] = Object.entries(params).reduce(
    ([sql, array, index], [key, value]) =>
      [sql.replace(`:${key}`, `$${index}`), [...array, value], index + 1] as QueryReducerArray,
    [parameterizedSql, [], 1] as QueryReducerArray
  )
  return {text, values}
}
