import {EntityQueryCallbackParams} from './executors'
import {entityQueriesFactory, EntityIteratorEntities} from './entities'
import {PostgresStorage} from 'src/store/postgres'

export async function* EntityIterator(
  store: PostgresStorage,
  entity: EntityIteratorEntities,
  {index: initialIndex = 0, batchSize = 100, ...rest}: EntityQueryCallbackParams
) {
  let index = initialIndex
  const entityQueries = entityQueriesFactory(store)
  const f = entityQueries[entity]

  while (true) {
    const {nextIndex, value} = await f({index, batchSize, ...rest})
    index = nextIndex
    yield value

    if (batchSize > value.length || nextIndex === -1) {
      return
    }
  }
}
