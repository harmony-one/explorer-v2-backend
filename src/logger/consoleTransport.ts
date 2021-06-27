import zerg from 'zerg'
import {TLogMessage} from 'zerg/dist/types'
import {getExtendedData} from './utils'
import {consoleNodeColorful} from 'zerg/dist/transports'
import {config} from 'src/config'
import {addLastLog} from './lastLogs'

function handler(logMessage: TLogMessage) {
  const date = new Date().toISOString()
  logMessage.message = `[${date}] ${logMessage.message}`

  // const args: any[] = [args, logMessage.message]
  // const extendedData = getExtendedData(logMessage)

  // if (extendedData) {
  //  args.push(extendedData)
  // }

  addLastLog(logMessage)
  return logMessage
}

const transportToConsole = zerg.createListener({
  handler: (...args) => consoleNodeColorful(handler(...args)),
  levels: config.logger.levels.console,
})

export default transportToConsole
