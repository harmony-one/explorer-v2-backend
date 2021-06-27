import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {ShardID} from 'src/types/blockchain'
import {catchAsync} from 'src/api/rest/utils'
import {FilterEntry, Filter, FilterType, FilterOrderDirection, FilterOrderBy} from 'src/types'
import {internalTransactionRouter} from 'src/api/rest/routes/internalTransaction'

export const stakingTransactionRouter = Router({mergeParams: true})

stakingTransactionRouter.get(
  '/block/number/:blockNumber',
  catchAsync(getStakingTransactionBlockNumber)
)

export async function getStakingTransactionBlockNumber(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {blockNumber, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getStakingTransactionsByField(s, 'block_number', +blockNumber)
  next(txs)
}

stakingTransactionRouter.get('/block/hash/:blockHash', catchAsync(getStakingTransactionByBlockHash))

export async function getStakingTransactionByBlockHash(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {blockHash, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getStakingTransactionsByField(s, 'block_hash', blockHash)
  next(txs)
}

stakingTransactionRouter.get('/hash/:hash', catchAsync(getStakingTransactionByHash))

export async function getStakingTransactionByHash(req: Request, res: Response, next: NextFunction) {
  const {hash, shardID} = req.params
  const s = +shardID as ShardID
  const tx = await controllers.getStakingTransactionsByField(s, 'hash', hash)
  next(tx)
}

stakingTransactionRouter.get('/', catchAsync(getStakingTransactions))

export async function getStakingTransactions(req: Request, res: Response, next: NextFunction) {
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
  const block = await controllers.getStakingTransactions(s, filter)
  next(block)
}

stakingTransactionRouter.get('/count', catchAsync(getCount))

export async function getCount(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const s = +shardID as ShardID
  const block = await controllers.getCount(s, 'stakingTransactions')
  next(block)
}
