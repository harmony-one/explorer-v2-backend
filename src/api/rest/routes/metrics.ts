import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const metricsRouter = Router({mergeParams: true})

metricsRouter.get('/transactionCount14d', catchAsync(getBinancePairPrice))

export async function getBinancePairPrice(req: Request, res: Response, next: NextFunction) {
  const data = await controllers.getTransactionCountLast14Days()
  next(data)
}
