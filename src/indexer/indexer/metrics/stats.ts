import {logger} from 'src/logger'
import {stores} from 'src/store'

const l = logger(module)
const interval = 1000 * 60 * 60 * 4

export const statsIndexer = () => {
  l.info('Wallets stats indexer starting...')
  loop()
}

const loop = async () => {
  const dateStart = Date.now()
  await stores[0].metrics.updateWalletsStats()
  l.info(`Wallets stats updated in ${Math.round((Date.now() - dateStart) / 1000)}s`)
  setTimeout(loop, interval)
}
