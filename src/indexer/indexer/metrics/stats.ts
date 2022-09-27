import {logger} from 'src/logger'
import {stores} from 'src/store'

const l = logger(module)
const interval = 1000 * 60 * 60 * 4

export const statsIndexer = () => {
  l.info('Metrics indexer starting...')
  runLoop()
}

const runLoop = async () => {
  try {
    const dateStart = Date.now()
    const limit = 14
    await Promise.all([
      stores[0].metrics.updateWalletsCount(limit),
      stores[0].metrics.updateTransactionsCount(limit),
      stores[0].metrics.updateAverageFee(limit),
      // stores[0].metrics.updateTopContracts(),
    ])
    l.info(`Daily metrics updated in ${Math.round((Date.now() - dateStart) / 1000)}s`)
  } catch (e) {
    l.error('Error on metrics update:', e.message)
  } finally {
    setTimeout(runLoop, interval)
  }
}
