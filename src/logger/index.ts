import zerg from 'zerg'
import sentryTransport from './sentryTransport'
import consoleTransport from './consoleTransport'

const loggerFactory = zerg.createLogger()

loggerFactory.addListener(consoleTransport)
loggerFactory.addListener(sentryTransport)

export function logger(module: {filename: string}, name = '') {
  let filename
  try {
    // commonjs
    filename = module.filename.split('src/')[1].split('.')[0]
  } catch (e) {
    // for webpack build
    // @ts-ignore
    filename = Object.keys(module.exports)[0] || 'main'
  }

  return loggerFactory.module([filename, name].filter((a) => a).join(':'))
}
