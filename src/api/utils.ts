export const errorToObject = (error: Error) => ({
  message: error.message || error,
  stack: error.stack || undefined,
})
