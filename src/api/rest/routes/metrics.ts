import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const metricsRouter = Router({mergeParams: true})

metricsRouter.get('/transactionCount14d', catchAsync(getTransactionCountLast14Days))

export async function getTransactionCountLast14Days(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const data = await controllers.getTransactionCountLast14Days()
  next(data)
}

metricsRouter.get('/walletsCount14d', catchAsync(getWalletsCountLast14Days))

export async function getWalletsCountLast14Days(req: Request, res: Response, next: NextFunction) {
  const data = await controllers.getWalletsCountLast14Days()
  next(data)
}
