import {FilterType, Filter} from 'src/types'
import {mapNamingReverse} from '../queryMapper'

const mapFilterTypeToSQL: Record<FilterType, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
  startsFrom: 'startsFrom',
}

const propertyToString = (property: string) => {
  return mapNamingReverse[property] || property
}

export const buildSQLQuery = (query: Filter) => {
  const safeSQL = (value: any) => {
    // todo safe trim value
    return (value + '')
      .split(' ')
      .join('')
      .replace(/[^a-zA-Z0-9 \\'_-]/g, '')
  }

  const whereQuery = query.filters
    .map((f) => {
      if (f.type === 'startsFrom') {
        return `${propertyToString(f.property)} like '${safeSQL(f.value)}%'`
      }

      return `${propertyToString(f.property)} ${mapFilterTypeToSQL[f.type]} ${safeSQL(f.value)}`
    })
    .join(' and ')

  const where = whereQuery ? `where ${whereQuery}` : ''
  const offset = query.offset ? `offset ${query.offset || 0}` : ''
  const limit = `limit ${query.limit || 10}`

  let order = ''
  if (query.orderBy && query.orderDirection) {
    order = `order by ${query.orderBy || 'number'} ${query.orderDirection || 'desc'}`
  }

  return `${where} ${order} ${offset} ${limit}`
}
