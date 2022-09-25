import {logger} from 'src/logger'
import {stores} from 'src/store'

const l = logger(module)
const interval = 1000 * 60 * 60 * 4

export const statsIndexer = () => {
  l.info('Metrics indexer starting...')
  runLoop()
  // runIndexer()
}

const runIndexer = async () => {
  try {
    const batchDays = 14
    for (let i = 0; i < 100; i++) {
      const from = i * batchDays + batchDays
      const to = i * batchDays
      const rowsWallets = await stores[0].metrics.updateWalletsCount(from, to)
      if (rowsWallets.length === 0) {
        console.log('Stop')
        break
      }
    }
  } catch (e) {
    console.log('Error on metrics batch update', e)
  }
}

const runLoop = async () => {
  try {
    const dateStart = Date.now()
    await Promise.all([
      stores[0].metrics.updateWalletsCount(14),
      // stores[0].metrics.updateTransactionsCount(14),
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
