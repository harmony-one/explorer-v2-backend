import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const priceRouter = Router({mergeParams: true})

priceRouter.get('/actual/:pair', catchAsync(getBinancePairPrice))

export async function getBinancePairPrice(req: Request, res: Response, next: NextFunction) {
  const {pair} = req.params
  const data = await controllers.getBinancePairPrice(pair)
  next(data)
}

priceRouter.get('/history/:pair', catchAsync(getBinancePairHistoricalPrice))

export async function getBinancePairHistoricalPrice(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {pair} = req.params
  const data = await controllers.getBinancePairHistoricalPrice(pair)
  next(data)
}
