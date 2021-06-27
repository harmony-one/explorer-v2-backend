import {TLogMessage} from 'zerg/dist/types'

const maxLength = 20
export const cache: String[] = []

export const addLastLog = (logMessage: TLogMessage) => {
  const m = `${logMessage.moduleName} ${logMessage.message}`
  cache.unshift(m)
  if (cache.length > maxLength) {
    cache.length = maxLength
  }
}

export const getLastLogs = () => {
  return cache.reverse()
}
