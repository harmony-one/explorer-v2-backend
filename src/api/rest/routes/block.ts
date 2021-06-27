import {Response, Request, Router, NextFunction} from 'express'
import {stores} from 'src/store'
import * as controllers from 'src/api/controllers'
import {ShardID} from 'src/types/blockchain'
import {catchAsync} from 'src/api/rest/utils'
import {FilterEntry, Filter, FilterType, FilterOrderDirection, FilterOrderBy} from 'src/types'

export const blockRouter = Router({mergeParams: true})

blockRouter.get('/number/:blockNumber', catchAsync(getBlockByNumber))

export async function getBlockByNumber(req: Request, res: Response, next: NextFunction) {
  const {blockNumber, shardID} = req.params
  const s = +shardID as ShardID
  const block = await controllers.getBlockByNumber(s, +blockNumber)
  next(block)
}

blockRouter.get('/hash/:blockHash', catchAsync(getBlockByHash))

export async function getBlockByHash(req: Request, res: Response, next: NextFunction) {
  const {blockHash, shardID} = req.params
  const s = +shardID as ShardID
  const block = await controllers.getBlockByHash(s, blockHash)
  next(block)
}

blockRouter.get('/', catchAsync(getBlocks))

export async function getBlocks(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const {offset, limit, orderBy, orderDirection, type, property, value} = req.query

  const filterEntries: FilterEntry[] = []

  if (type && value && property) {
    filterEntries.push({type, property, value} as FilterEntry)
  }

  const filter: Filter = {
    offset: (+offset! as number) || 0,
    limit: (+limit! as number) || 0,
    orderBy: (orderBy as FilterOrderBy) || 'number',
    orderDirection: (orderDirection as FilterOrderDirection) || 'desc',
    filters: filterEntries,
  }

  const s = +shardID as ShardID
  const block = await controllers.getBlocks(s, filter)
  next(block)
}

blockRouter.get('/count', catchAsync(getBlockCount))

export async function getBlockCount(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const s = +shardID as ShardID
  const block = await controllers.getCount(s, 'blocks')
  next(block)
}
