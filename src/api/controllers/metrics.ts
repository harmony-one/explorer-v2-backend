import {withCache} from 'src/api/controllers/cache'
import {stores} from 'src/store'
import {MetricsDailyType, MetricsTopType} from 'src/types'
import {validator} from 'src/utils/validators/validators'
import {isLimit, isOffset, isOneOf} from 'src/utils/validators'

const DefaultLimit = 14

export async function getTransactionCountLast14Days(limit = DefaultLimit): Promise<any | null> {
  return await withCache(
    ['getTransactionCountLast14Days', arguments],
    () => stores[0].metrics.getTransactionCount(0, limit),
    // () => Promise.race([getTxsCount(), timeout()]),
    1000 * 60 * 60 * 1
  )
}

export async function getWalletsCountLast14Days(limit = DefaultLimit): Promise<any> {
  const count = await withCache(
    ['getWalletsCountLast14Days', arguments],
    () => stores[0].metrics.getWalletsCount(limit),
    // () => Promise.race([getWalletsCount(), timeout()]),
    1000 * 60 * 60 * 1
  )

  return count
}

export async function getMetricsByType(
  type: MetricsDailyType,
  offset = 0,
  limit = DefaultLimit
): Promise<any | null> {
  validator({
    type: isOneOf(type, [...Object.values(MetricsDailyType)]),
    offset: isOffset(offset),
    limit: isLimit(limit, 2000),
  })
  return await withCache(
    ['getMetricsByType', arguments],
    () => stores[0].metrics.getMetricsByType(type, offset, limit),
    1000 * 60 * 60 * 1
  )
}

export async function getTopMetricsByType(type: MetricsTopType, period = 1): Promise<any | null> {
  validator({
    type: isOneOf(type, [...Object.values(MetricsDailyType)]),
    period: isOneOf(period, [1, 3, 7]),
  })
  return await withCache(
    ['getTopMetricsByType', arguments],
    () => stores[0].metrics.getTopMetricsByType(type, period),
    1000 * 60 * 10
  )
}
