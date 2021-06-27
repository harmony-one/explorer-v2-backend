import {EntityQueryCallbackParams} from './executors'
import {entityQueries, EntityIteratorEntities} from './entities'

export async function* EntityIterator(
  entity: EntityIteratorEntities,
  {index: initialIndex = 0, batchSize = 100, ...rest}: EntityQueryCallbackParams
) {
  let index = initialIndex

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
