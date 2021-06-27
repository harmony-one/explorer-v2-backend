import {config} from 'src/config'
import {ShardID} from 'src/types'

export type Validator = (value: any, params?: any) => void
export type ParamValidator = () => void
export type CurryParamValidator = (value: any, params?: any) => ParamValidator

type ErrorEntry = {error: Error; key: string}

export const isShardAvailable: Validator = (value: ShardID) => {
  if (!config.api.shards.includes(value)) {
    throw new Error(
      `shard ${value} is not available. Available shards: [${config.api.shards.join(', ')}]`
    )
  }
}

export const isHexString: Validator = (value: string) => {
  if (/^0x[a-f0-9]+$/.test(value)) {
    return
  }

  throw new Error('should be lowercase hex string starting with 0x')
}

export const isStartingWith0x: Validator = (value: string) => {
  if (value[0] === '0' && value[1] === 'x') {
    return
  }

  throw new Error('should be hex string starting with 0x')
}

export const isOneOf: Validator = (value: string, options: string[]) => {
  if (options.includes(value)) {
    return
  }

  throw new Error(`should be one of [${options.join(', ')}]`)
}

export const isUint: Validator = (value, {min, max} = {}) => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('should be a number')
  }
  if (min && value < min) {
    throw new Error(`should be greater or equal ${min}`)
  }
  if (value < 0) {
    throw new Error(`should be greater or equal 0`)
  }
  if (max && value > max) {
    throw new Error(`should be less or equal ${max}`)
  }
}

export const isLength: Validator = (value, {min, max}) => {
  if (typeof value !== 'string') {
    throw new Error('should be a string')
  }
  if (min && value.length < min) {
    throw new Error(`length should be greater or equal ${min}`)
  }
  if (max && value.length > max) {
    throw new Error(`length should be less or equal ${max}`)
  }
}

export const validator = (validators: Record<string, ParamValidator | ParamValidator[]>) => {
  const errors: ErrorEntry[] = []
  const keys = Object.keys(validators)

  const run = (f: ParamValidator, key: string) => {
    try {
      f()
    } catch (error) {
      errors.push({error, key})
    }
  }

  keys.forEach((key) => {
    const f = validators[key]
    if (Array.isArray(f)) {
      f.forEach((a) => run(a, key))
    } else {
      run(f, key)
    }
  })

  if (errors.length > 0) {
    const message = `${errors.map((e) => `${e.key}: ${e.error.message || e}`).join(', ')}`
    throw new Error(message)
  }
}
