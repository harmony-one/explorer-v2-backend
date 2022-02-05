export const arrayChunk = (arr: any[], chunkSize: number) => {
  if (chunkSize <= 0) throw 'Invalid chunk size'
  let R = []
  for (let i = 0, len = arr.length; i < len; i += chunkSize) R.push(arr.slice(i, i + chunkSize))
  return R
}

// had to introduce the value since postgres refuses to process too many requests in a time
export const defaultChunkSize = 1000
