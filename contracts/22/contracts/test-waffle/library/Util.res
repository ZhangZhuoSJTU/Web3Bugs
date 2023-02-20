let await = %raw(`(asyncFunction) => {
  let result = null;
  let waiting = true;
  asyncFunction().then((asyncResult) => {
    result = asyncResult
    waiting = false
  })

  while (waiting) {
  }
  return result
}
`)
