export const logTime = () => {
  const now = Date.now()

  return function done() {
    const timePassed = Date.now() - now

    return {
      val: timePassed,
      toString: () => `${timePassed}ms`,
    }
  }
}
