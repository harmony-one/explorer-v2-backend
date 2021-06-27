import {logger} from './logger'
import {config, init as configInit} from 'src/config'

// import {run as eventSignaturesRun} from 'src/indexer/indexer/contracts/eventSignatures/eventSignatures'

const l = logger(module)

const run = async () => {
  l.info(`Harmony Explorer v${config.info.version}. Git commit hash: ${config.info.gitCommitHash}`)
  // eventSignaturesRun()
  await configInit()

  try {
    if (config.api.isEnabled) {
      const {api} = require('src/api')
      await api()
    } else {
      l.debug('API is disabled')
    }

    if (config.indexer.isEnabled) {
      const {indexer} = require('src/indexer')
      await indexer()
    } else {
      l.debug('Indexer is disabled')
    }
  } catch (err) {
    l.error(err)
    l.error(err.stack)
    process.exit(1)
  }
}

run()
