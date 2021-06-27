import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const erc721Router = Router({mergeParams: true})

erc721Router.get('/', catchAsync(getAllERC721))

export async function getAllERC721(req: Request, res: Response, next: NextFunction) {
  const data = await controllers.getAllERC721()
  next(data)
}

erc721Router.get('/address/:address/balances', catchAsync(getUserERC721Assets))

export async function getUserERC721Assets(req: Request, res: Response, next: NextFunction) {
  const {address} = req.params
  const data = await controllers.getUserERC721Assets(address)
  next(data)
}

erc721Router.get('/token/:address/balances', catchAsync(getTokenERC721Assets))

export async function getTokenERC721Assets(req: Request, res: Response, next: NextFunction) {
  const {address} = req.params
  const data = await controllers.getTokenERC721Assets(address)
  next(data)
}
