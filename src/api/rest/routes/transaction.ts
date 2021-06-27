import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {ShardID} from 'src/types/blockchain'
import {catchAsync} from 'src/api/rest/utils'
import {FilterEntry, Filter, FilterType, FilterOrderDirection, FilterOrderBy} from 'src/types'
import {stakingTransactionRouter} from 'src/api/rest/routes/stakingTransaction'

export const transactionRouter = Router({mergeParams: true})

transactionRouter.get('/block/number/:blockNumber', catchAsync(getTransactionBlockNumber))

export async function getTransactionBlockNumber(req: Request, res: Response, next: NextFunction) {
  const {blockNumber, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getTransactionByField(s, 'block_number', +blockNumber)
  next(txs)
}

transactionRouter.get('/block/hash/:blockHash', catchAsync(getTransactionByBlockHash))

export async function getTransactionByBlockHash(req: Request, res: Response, next: NextFunction) {
  const {blockHash, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getTransactionByField(s, 'block_hash', blockHash)
  next(txs)
}

transactionRouter.get('/hash/:hash', catchAsync(getTransactionByHash))

export async function getTransactionByHash(req: Request, res: Response, next: NextFunction) {
  const {hash, shardID} = req.params
  const s = +shardID as ShardID
  const tx = await controllers.getTransactionByField(s, 'hash', hash)
  next(tx)
}

transactionRouter.get('/', catchAsync(getTransactions))

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const {offset, limit, orderBy, orderDirection, type, property, value} = req.query

  const filterEntries: FilterEntry[] = []

  if (type && value && property) {
    filterEntries.push({type, property, value} as FilterEntry)
  }

  const filter: Filter = {
    offset: (+offset! as number) || 0,
    limit: (+limit! as number) || 0,
    orderBy: (orderBy as FilterOrderBy) || 'block_number',
    orderDirection: (orderDirection as FilterOrderDirection) || 'desc',
    filters: filterEntries,
  }

  const s = +shardID as ShardID
  const block = await controllers.getTransactions(s, filter)
  next(block)
}

transactionRouter.get('/count', catchAsync(getCount))

export async function getCount(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const s = +shardID as ShardID
  const block = await controllers.getCount(s, 'transactions')
  next(block)
}
