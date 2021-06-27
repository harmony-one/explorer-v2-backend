import zerg from 'zerg'
import {TLogMessage} from 'zerg/dist/types'
import * as Sentry from '@sentry/node'
import {getExtendedData} from './utils'
import {config} from 'src/config'

const SENTRY_LEVEL_MAP = {
  debug: Sentry.Severity.Debug,
  verbose: Sentry.Severity.Log,
  info: Sentry.Severity.Info,
  warn: Sentry.Severity.Warning,
  error: Sentry.Severity.Error,
  fatal: Sentry.Severity.Fatal,
  metric: Sentry.Severity.Debug,
  event: Sentry.Severity.Debug,
}

function extractException(logMessage: TLogMessage) {
  if (logMessage.extendedData && logMessage.extendedData.error) {
    return logMessage.extendedData.error
  }
  return null
}

interface TCopyErrorsParams {
  name: string
  message: string
  originalError: Error
}
function copyError({name, message, originalError}: TCopyErrorsParams) {
  const error = new Error()

  error.name = name
  error.message = message
  error.stack = originalError.stack

  return error
}

function handler(logMessage: TLogMessage) {
  const level = SENTRY_LEVEL_MAP[logMessage.level]

  const extendedData = getExtendedData(logMessage) || {}

  Sentry.withScope((scope) => {
    scope.setLevel(level)
    scope.setTag('module', logMessage.moduleName)

    if (logMessage.extendedData) {
      scope.setExtras(extendedData)
    }

    const error = extractException(logMessage)

    if (error && error instanceof Error) {
      const errorCopy = copyError({
        name: logMessage.message,
        message: `${error.name} ${error.message || ''}`.trim(),
        originalError: error,
      })
      Sentry.captureException(errorCopy)
      return
    }

    Sentry.captureMessage(logMessage.message)
  })
}

const sentryTransport = zerg.createListener({
  handler,
  levels: config.logger.levels.sentry,
})

export default sentryTransport
