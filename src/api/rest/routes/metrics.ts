import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'
import {MetricsDailyType} from 'src/types'

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

metricsRouter.get('/', catchAsync(getMetricsByType))

export async function getMetricsByType(req: Request, res: Response, next: NextFunction) {
  const {type, offset, limit} = req.query
  const filter = {
    offset: (+offset! as number) || 0,
    limit: (+limit! as number) || 14,
  }
  const data = await controllers.getMetricsByType(
    type as MetricsDailyType,
    filter.offset,
    filter.limit
  )
  next(data)
}
