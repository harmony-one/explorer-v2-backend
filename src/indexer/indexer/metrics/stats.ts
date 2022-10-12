import {logger} from 'src/logger'
import {stores} from 'src/store'
import {MetricsTopType} from 'src/types'

const l = logger(module)
const interval = 1000 * 60 * 60 * 4

export const statsIndexer = () => {
  l.info('Metrics indexer starting...')
  // runLoop()
  updateTopDailyMetrics()
}

const runLoop = async () => {
  try {
    const dateStart = Date.now()
    const limit = 14
    await Promise.all([
      stores[0].metrics.updateWalletsCount(limit),
      stores[0].metrics.updateTransactionsCount(limit),
      stores[0].metrics.updateAverageFee(limit),
      stores[0].metrics.updateBlockSize(limit),
    ])
    await updateTopDailyMetrics()
    l.info(`Daily metrics updated in ${Math.round((Date.now() - dateStart) / 1000)}s`)
  } catch (e) {
    l.error('Error on metrics update:', e.message)
  } finally {
    setTimeout(runLoop, interval)
  }
}

const updateTopDailyMetrics = async () => {
  const periods = [1, 3, 7] // Top metrics for each 1, 3, 7 last days period
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]
    await stores[0].metrics.updateTopOne(MetricsTopType.topOneSender, period)
    await stores[0].metrics.updateTopOne(MetricsTopType.topOneReceiver, period)
    await stores[0].metrics.updateTopTxsCount(MetricsTopType.topTxsCountSent, period)
    await stores[0].metrics.updateTopTxsCount(MetricsTopType.topTxsCountReceived, period)
  }
}

// const runDailyMetricsIndexer = async () => {
//   try {
//     const offset = 0 // manually set offset to continue interrupted migration
//     const batchDays = 1
//     for (let i = 0; i < 14; i++) {
//       const from = offset + i * batchDays + batchDays
//       const to = offset + i * batchDays
//       const timeStart = Date.now()
//       console.log('Index metrics: i', i, 'from', from, 'to', to)
//       const rows = await stores[0].metrics.updateWalletsCount(from, to)
//       console.log('Results count:', rows.length, Math.round((Date.now() - timeStart) / 1000), 's')
//       if (rows.length === 0) {
//         break
//       }
//     }
//     console.log('Stop metrics')
//   } catch (e) {
//     console.log('Error on metrics batch update', e)
//   }
// }
