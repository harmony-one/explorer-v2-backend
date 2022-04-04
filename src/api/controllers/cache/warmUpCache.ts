import * as controllers from 'src/api/controllers'
import {config} from 'src/config'
import {logger} from 'src/logger'
const l = logger(module, 'cache')

export const warmUpCache = async () => {
  if (!config.api.isCacheEnabled) {
    return
  }
  l.info('Warming up...')

  await Promise.all([
    controllers.getTransactionCountLast14Days(),
    controllers.getWalletsCountLast14Days(),
    controllers.getBinancePairHistoricalPrice('ONEUSDT'),
    controllers.getBinancePairPrice('ONEUSDT'),
  ])

  l.info('Done')
}
