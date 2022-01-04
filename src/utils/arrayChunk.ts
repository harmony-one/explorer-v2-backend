// had to introduce the value since postgres refuses to process too many requests in a time
export const defaultChunkSize = 1000

export const arrayChunk = (arr: any[], chunkSize = defaultChunkSize) => {
  if (chunkSize <= 0) throw Error('Invalid chunk size')
  const R = []
  for (let i = 0, len = arr.length; i < len; i += chunkSize) {
    R.push(arr.slice(i, i + chunkSize))
  }
  return R
}
