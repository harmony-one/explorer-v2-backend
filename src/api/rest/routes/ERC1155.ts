import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'
import {ShardID} from 'src/types/blockchain'

export const erc1155Router = Router({mergeParams: true})

erc1155Router.get('/', catchAsync(getAllERC1155))

export async function getAllERC1155(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const s = +shardID as ShardID
  const data = await controllers.getAllERC1155(s)
  next(data)
}

erc1155Router.get('/address/:address/balances', catchAsync(getUserERC1155Balances))

export async function getUserERC1155Balances(req: Request, res: Response, next: NextFunction) {
  const {address, shardID} = req.params
  const s = +shardID as ShardID
  const data = await controllers.getUserERC1155Balances(s, address)
  next(data)
}

erc1155Router.get('/token/:address/balances', catchAsync(getTokenERC1155Balances))

export async function getTokenERC1155Balances(req: Request, res: Response, next: NextFunction) {
  const {address, shardID} = req.params
  const s = +shardID as ShardID
  const data = await controllers.getTokenERC1155Balances(s, address)
  next(data)
}

erc1155Router.get('/token/:address/assets', catchAsync(getTokenERC1155Assets))

export async function getTokenERC1155Assets(req: Request, res: Response, next: NextFunction) {
  const {address, shardID} = req.params
  const s = +shardID as ShardID
  const data = await controllers.getTokenERC1155Assets(s, address)
  next(data)
}

erc1155Router.get('/token/:address/asset/:tokenID', catchAsync(getTokenERC1155AssetDetails))

export async function getTokenERC1155AssetDetails(req: Request, res: Response, next: NextFunction) {
  const {address, tokenID, shardID} = req.params
  const s = +shardID as ShardID
  const data = await controllers.getTokenERC1155AssetDetails(s, address, tokenID)
  next(data)
}
