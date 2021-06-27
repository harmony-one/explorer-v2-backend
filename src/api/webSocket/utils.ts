import * as controllers from 'src/api/controllers'
const getArgs = (func: Function) => {
  if (func.length === 0) {
    return []
  }

  const string = func.toString()

  // First match everything inside the function argument parens. like `function (arg1,arg2) {}` or `async function(arg1,arg2) {}
  const args =
    string.match(/(?:async|function)\s*.*?\(([^)]*)\)/)?.[1] ||
    // arrow functions with multiple arguments  like `(arg1,arg2) => {}`
    string.match(/^\s*\(([^)]*)\)\s*=>/)?.[1] ||
    // arrow functions with single argument without parens like `arg => {}`
    string.match(/^\s*([^=]*)=>/)?.[1]

  return args!.split(',').map((arg) => arg.replace(/\/\*.*\*\//, '').trim())
}

export const getMethods = () => {
  const keys = Object.keys(controllers)
  return keys.map((k) => {
    // @ts-ignore
    const method = controllers[k]
    const params = getArgs(method)
    return {method: method.name, params}
  })
}
