import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'
import {ParsedQs} from 'qs'

export const erc20Router = Router({mergeParams: true})

erc20Router.get('/', catchAsync(getAllERC20))

export async function getAllERC20(req: Request, res: Response, next: NextFunction) {
  const data = await controllers.getAllERC20()
  next(data)
}

erc20Router.get('/address/:address/balances', catchAsync(getUserERC20Balances))

export async function getUserERC20Balances(req: Request, res: Response, next: NextFunction) {
  const {address} = req.params
  const data = await controllers.getUserERC20Balances(address)
  next(data)
}

erc20Router.get('/token/:address/holders', catchAsync(getERC20TokenHolders))

export async function getERC20TokenHolders(req: Request, res: Response, next: NextFunction) {
  const {address} = req.params
  const {offset, limit} = req.query
  const formatNumber = (
    digits: string | string[] | ParsedQs | ParsedQs[] | undefined,
    def: number
  ): number => {
    if (!digits) {
      return def
    }
    const num = parseInt(digits.toString(), 10)
    return Number.isFinite(num) ? num : def
  }
  const data = await controllers.getERC20TokenHolders(
    address,
    formatNumber(limit, 100),
    formatNumber(offset, 0)
  )
  next(data)
}
