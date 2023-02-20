const lockContract = artifacts.require('PublicLock')
const lockInterface = artifacts.require('IPublicLock')

contract('Lock / interface', () => {
  it('The interface includes all public functions', async () => {
    // log any missing entries
    lockContract.abi
      .filter((x) => x.type === 'function')
      .forEach((entry) => {
        if (
          lockInterface.abi.filter((x) => x.name === entry.name).length ===
          lockContract.abi.filter((x) => x.name === entry.name).length
        ) {
          return
        }
        // eslint-disable-next-line no-console
        console.log(entry)
      })

    // and assert the count matches
    const count = lockInterface.abi.filter((x) => x.type === 'function').length
    const expected = lockContract.abi.filter(
      (x) => x.type === 'function'
    ).length
    assert.notEqual(count, 0)
    assert.equal(count, expected)
  })
})
