import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const erc1155Router = Router({mergeParams: true})

erc1155Router.get('/', catchAsync(getAllERC1155))

export async function getAllERC1155(req: Request, res: Response, next: NextFunction) {
  const data = await controllers.getAllERC1155()
  next(data)
}

erc1155Router.get('/address/:address/balances', catchAsync(getUserERC1155Balances))

export async function getUserERC1155Balances(req: Request, res: Response, next: NextFunction) {
  const {address} = req.params
  const data = await controllers.getUserERC1155Balances(address)
  next(data)
}

erc1155Router.get('/token/:address/assets', catchAsync(getTokenERC1155Assets))

export async function getTokenERC1155Assets(req: Request, res: Response, next: NextFunction) {
  const {address} = req.params
  const data = await controllers.getTokenERC1155Assets(address)
  next(data)
}
