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

export const generateMultipleQuery = (records: Record<any, any>[]) => {
  if (records.length === 0) {
    throw new Error('No records to generate query')
  }
  let queryMultiple = ''
  let paramsMultiple: any = []
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const {query, params} = generateQuery(record)
    if (i === 0) {
      queryMultiple = query
      paramsMultiple = params
    } else {
      const paramsList = params.map((_, index) => `$${paramsMultiple.length + index + 1}`).join(',')
      queryMultiple += `, (${paramsList})`
      paramsMultiple.push(...params)
    }
  }
  return {
    query: queryMultiple,
    params: paramsMultiple,
  }
}
