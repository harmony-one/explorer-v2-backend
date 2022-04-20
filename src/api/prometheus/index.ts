const Prometheus = require('prom-client')

const register = new Prometheus.Registry()

register.setDefaultLabels({
  app: 'explorer-api',
})

Prometheus.collectDefaultMetrics({register})

const requestDurationMs = new Prometheus.Histogram({
  name: 'request_duration_seconds',
  help: 'Duration of requests in seconds',
  labelNames: ['route'],
  buckets: [0.1, 0.5, 1, 5, 10, 30],
})

register.registerMetric(requestDurationMs)

export const withMetrics = async (route: string, f: Promise<any>) => {
  const end = requestDurationMs.startTimer()
  const result = await f
  const durationSeconds = end()
  requestDurationMs.labels(route).observe(durationSeconds)
  return result
}

export default register
