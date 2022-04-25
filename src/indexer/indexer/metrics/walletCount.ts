import {logger} from 'src/logger'
import {stores} from 'src/store'

const l = logger(module)
const interval = 1000 * 60 * 60 * 12

export const walletCountIndexer = () => {
  // l.info('Wallet counter starting...')
  // l.warn('Heavy task, make sure you need it enabled')
  // loop()
}

const loop = async () => {
  await stores[0].metrics.addWalletsCountLast14Days()
  setTimeout(loop, interval)
}
