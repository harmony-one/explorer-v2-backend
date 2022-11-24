import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const erc20Router = Router({mergeParams: true})

erc20Router.get('/', catchAsync(getAllERC20))

export async function getAllERC20(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const s = +shardID as ShardID
  const data = await controllers.getAllERC20(s)
  next(data)
}

erc20Router.get('/address/:address/balances', catchAsync(getUserERC20Balances))

export async function getUserERC20Balances(req: Request, res: Response, next: NextFunction) {
  const {address, shardID} = req.params
  const s = +shardID as ShardID
  const data = await controllers.getUserERC20Balances(s, address)
  next(data)
}

erc20Router.get('/token/:address/holders', catchAsync(getERC20TokenHolders))

export async function getERC20TokenHolders(req: Request, res: Response, next: NextFunction) {
  const {address, shardID} = req.params
  const s = +shardID as ShardID
  const {offset, limit} = req.query
  const filter = {
    offset: (+offset! as number) || 0,
    limit: (+limit! as number) || 100,
  }
  const data = await controllers.getERC20TokenHolders(s, address, filter.limit, filter.offset)
  next(data)
}
