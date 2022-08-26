import * as dotenv from 'dotenv'
import assert from 'assert'
import {TLogLevel} from 'zerg/dist/types'
import {ShardID} from 'src/types'
import {getGitCommitHash} from 'src/utils/getGitCommitHash'
import fs from 'fs'
import path from 'path'
import {run as initAWSKMS} from './utils/kms/index'

const packageJSON = require('../package.json')

let VERSIONFileData: String

try {
  VERSIONFileData = `${fs.readFileSync(path.join(__dirname, '../', './VERSION'))}`
} catch (e) {
  VERSIONFileData = 'Unset'
}

dotenv.config()

const toBool = (value: string = '0') => !!+value

const required: Record<string, string> = {
  INDEXER_BATCH_COUNT: 'number',
}

if (toBool(process.env.INDEXER_IS_ENABLED)) {
  Object.keys(required).map((k) => {
    assert(process.env[k], `Env variable "${k}" must be defined`)
    assert(
      required[k] === 'number' ? !isNaN(+process.env[k]!) : true,
      `Env variable "${k}" should be "${required[k]}"`
    )
  })
}

const getCommaSeparatedList = (list: string | undefined): string[] =>
  (list || '')
    .split(' ')
    .filter((a) => a)
    .join('')
    .split(',')

const getChainID = (v: any): number => {
  if (v === 'mainnet') {
    return 1666600000
  }
  return +v
}

export const config = {
  info: {
    gitCommitHash: getGitCommitHash(),
    version: packageJSON.version,
    VERSIONFileData,
    isAWSKMSEnabled: process.env.AWS_CONFIG_IS_ENABLE,
  },
  api: {
    shards: getCommaSeparatedList(process.env.API_SHARDS).map((s) => +s) as ShardID[],
    isEnabled: toBool(process.env.API_IS_ENABLED || '0'),
    isCacheEnabled: toBool(process.env.API_IS_CACHE_ENABLED || '0'),
    cacheMaxSize: +(process.env.API_CACHE_MAX_SIZE || 1000),
    internalTxsBlockNumberStart: +(process.env.INTERNAL_TXS_BLOCK_NUMBER_START || 23000000),
    ws: {
      isEnabled: toBool(process.env.API_WS_IS_ENABLED || '0'),
      port: 3001,
      isDemoHTMLPageEnabled: true,
    },
    rest: {
      isEnabled: toBool(process.env.API_REST_IS_ENABLED || '0'),
      port: +(process.env.API_REST_PORT || 3000),
      apiKey: process.env.API_REST_ACCESS_KEY || '',
    },
    // JSON RPC endpoint available on POST /v0/rpc. Requires API_REST_IS_ENABLED=1
    json_rpc: {
      isEnabled: toBool(process.env.API_RPC_IS_ENABLED || '1'),
      ethGetLogsLimit: +(process.env.RPC_GET_LOGS_LIMIT || 1024), // Blocks range limit for method "eth_getLogs"
    },
    grpc: {
      isEnabled: toBool(process.env.API_GRPC_IS_ENABLED || '0'),
      port: 5051,
    },
    rateLimiter: {
      isEnabled: toBool(process.env.API_RATE_LIMITER_IS_ENABLED || '1'),
      windowMs: +(process.env.API_RATE_LIMITER_WINDOW_MS || 10 * 60 * 1000), // 10 minutes
      max: +(process.env.API_RATE_LIMITER_MAX || 200), // // Limit each IP to 200 requests per `windowMs` = 10 minutes
    },
  },
  indexer: {
    chainID: getChainID(process.env.CHAIN_ID || 'mainnet'),
    shards: getCommaSeparatedList(process.env.INDEXER_SHARDS).map((s) => +s) as ShardID[],
    isEnabled: toBool(process.env.INDEXER_IS_ENABLED || '0'),
    isSyncingBlocksEnabled: toBool(process.env.INDEXER_BLOCKS_IS_ENABLED || '0'),
    isSyncingLogsEnabled: toBool(process.env.INDEXER_LOGS_IS_ENABLED || '0'),
    isSyncingContractsEnabled: toBool(process.env.INDEXER_CONTRACTS_IS_ENABLED || '0'),
    isSyncedThreshold: +(process.env.INDEXER_IS_SYNCED_THRESHOLD || 10),
    trackContractTypes: getCommaSeparatedList(process.env.INDEXER_CONTRACTS_TYPES),
    initialBlockSyncingHeight: +(process.env.INDEXER_INITIAL_BLOCK_SYNCING_HEIGHT || 0),
    // set to the height where smart contracts were introduced on the chain
    initialLogsSyncingHeight: +(process.env.INDEXER_LOG_INITIAL_BLOCK_SYNCING_HEIGHT || 3500000),
    batchCount: +(process.env.INDEXER_BATCH_COUNT || 100),
    blockIndexerBlockRange: +(process.env.BLOCK_INDEXER_BLOCK_RANGE || 10),
    rpc: {
      transport: process.env.INDEXER_RPC_TRANSPORT || 'ws',
      urls: [
        getCommaSeparatedList(process.env.INDEXER_RPC_SHARD0),
        getCommaSeparatedList(process.env.INDEXER_RPC_SHARD1),
        getCommaSeparatedList(process.env.INDEXER_RPC_SHARD2),
        getCommaSeparatedList(process.env.INDEXER_RPC_SHARD3),
      ],
    },
    infoWebServer: {
      isEnabled: true,
      port: 3002,
    },
    // with trailing slash
    IPFSGateway: process.env.INDEXER_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  },
  store: {
    postgres: [
      {
        user: process.env.SHARD0_POSTGRES_USER,
        host: process.env.SHARD0_POSTGRES_HOST,
        database: process.env.SHARD0_POSTGRES_DB,
        password: process.env.SHARD0_POSTGRES_PASSWORD,
        port: +(process.env.SHARD0_POSTGRES_PORT || 5432),
        poolSize: +(process.env.SHARD0_POSTGRES_POOL_SIZE || 20),
      },
      {
        user: process.env.SHARD1_POSTGRES_USER,
        host: process.env.SHARD1_POSTGRES_HOST,
        database: process.env.SHARD1_POSTGRES_DB,
        password: process.env.SHARD1_POSTGRES_PASSWORD,
        port: +(process.env.SHARD1_POSTGRES_PORT || 5432),
        poolSize: +(process.env.SHARD1_POSTGRES_POOL_SIZE || 20),
      },
      {
        user: process.env.SHARD2_POSTGRES_USER,
        host: process.env.SHARD2_POSTGRES_HOST,
        database: process.env.SHARD2_POSTGRES_DB,
        password: process.env.SHARD2_POSTGRES_PASSWORD,
        port: +(process.env.SHARD2_POSTGRES_PORT || 5432),
        poolSize: +(process.env.SHARD2_POSTGRES_POOL_SIZE || 20),
      },
      {
        user: process.env.SHARD3_POSTGRES_USER,
        host: process.env.SHARD3_POSTGRES_HOST,
        database: process.env.SHARD3_POSTGRES_DB,
        password: process.env.SHARD3_POSTGRES_PASSWORD,
        port: +(process.env.SHARD3_POSTGRES_PORT || 5432),
        poolSize: +(process.env.SHARD3_POSTGRES_POOL_SIZE || 20),
      },
    ],
  },
  logger: {
    levels: {
      console: process.env.STDOUT_LOG_LEVELS
        ? (getCommaSeparatedList(process.env.STDOUT_LOG_LEVELS) as TLogLevel[])
        : (['error', 'info', 'warn', 'debug'] as TLogLevel[]),
      sentry: ['error', 'warn'] as TLogLevel[],
    },
  },
}

export const init = async () => {
  const filteredSymbols = ['=', ' ']
  const trimSpaces = (s: string) => {
    return s
      .split('')
      .filter((l) => !filteredSymbols.includes(l))
      .join('')
  }

  const parseValue = (s: string, v: string) => {
    return trimSpaces(s.split(v)[1].split('\n')[0])
  }

  if (toBool(process.env.AWS_CONFIG_IS_ENABLE)) {
    const decrypted = (await initAWSKMS()) as string

    config.store.postgres[0].user = parseValue(decrypted, 'SHARD0_POSTGRES_USER')
    config.store.postgres[0].password = parseValue(decrypted, 'SHARD0_POSTGRES_PASSWORD')
    config.store.postgres[1].user = parseValue(decrypted, 'SHARD1_POSTGRES_USER')
    config.store.postgres[1].password = parseValue(decrypted, 'SHARD1_POSTGRES_PASSWORD')
    config.store.postgres[2].user = parseValue(decrypted, 'SHARD2_POSTGRES_USER')
    config.store.postgres[2].password = parseValue(decrypted, 'SHARD2_POSTGRES_PASSWORD')
    config.store.postgres[3].user = parseValue(decrypted, 'SHARD3_POSTGRES_USER')
    config.store.postgres[3].password = parseValue(decrypted, 'SHARD3_POSTGRES_PASSWORD')
  }
}
