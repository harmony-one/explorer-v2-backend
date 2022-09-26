import {logger} from 'src/logger'
import {stores} from 'src/store'

const l = logger(module)
const interval = 1000 * 60 * 60 * 4

export const statsIndexer = () => {
  l.info('Metrics indexer starting...')
  runLoop()
  // runMetricsIndexer()
}

const runLoop = async () => {
  try {
    const dateStart = Date.now()
    const limit = 14
    await Promise.all([
      stores[0].metrics.updateWalletsCount(limit),
      stores[0].metrics.updateTransactionsCount(limit),
      stores[0].metrics.updateAverageFee(limit),
      stores[0].metrics.updateTopContracts(),
    ])
    l.info(
      `Transactions and Wallets stats updated in ${Math.round((Date.now() - dateStart) / 1000)}s`
    )
  } catch (e) {
    l.error('Error on metrics update:', e.message)
  } finally {
    setTimeout(runLoop, interval)
  }
}

const runMetricsIndexer = async () => {
  try {
    const batchDays = 14
    for (let i = 0; i < 100; i++) {
      const from = i * batchDays + batchDays
      const to = i * batchDays
      console.log('Index metrics: i', i, 'from', from, 'to', to)
      const rowsWallets = await stores[0].metrics.updateWalletsCount(from, to)
      const rowsTxs = await stores[0].metrics.updateTransactionsCount(from, to)
      const rowsFee = await stores[0].metrics.updateAverageFee(from, to)
      console.log('Index metrics result:', rowsWallets.length, rowsTxs.length, rowsFee.length)
      if (rowsWallets.length + rowsTxs.length + rowsFee.length === 0) {
        console.log('Stop metrics')
        break
      }
    }
  } catch (e) {
    console.log('Error on metrics batch update', e)
  }
}
