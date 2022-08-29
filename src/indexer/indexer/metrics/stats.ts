import {logger} from 'src/logger'
import {stores} from 'src/store'

const l = logger(module)
const interval = 1000 * 60 * 60 * 4

export const statsIndexer = () => {
  l.info('Wallets stats indexer starting...')
  loop()
}

const loop = async () => {
  try {
    const dateStart = Date.now()
    await Promise.all([
      stores[0].metrics.updateWalletsCount(14),
      stores[0].metrics.updateTransactionsCount(14),
    ])
    l.info(
      `Transactions and Wallets stats updated in ${Math.round((Date.now() - dateStart) / 1000)}s`
    )
  } catch (e) {
    l.error('Cannot update txs and wallets stats:', e.message)
  } finally {
    setTimeout(loop, interval)
  }
}
