import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {ShardID} from 'src/types/blockchain'
import {catchAsync} from 'src/api/rest/utils'

export const adminRouter = Router({mergeParams: true})

adminRouter.get('/reindex', catchAsync(reindexBlock))

export async function reindexBlock(req: Request, res: Response, next: NextFunction) {
  const {shardID = 0, blockNumber = -1} = req.query
  const s = +shardID as ShardID
  const block = await controllers.reindexBlock(s, +blockNumber)
  next(block)
}
