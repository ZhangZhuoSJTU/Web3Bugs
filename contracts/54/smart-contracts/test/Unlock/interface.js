const unlockContract = artifacts.require('Unlock.sol')
const unlockInterface = artifacts.require('IUnlock.sol')

contract('Unlock / interface', () => {
  it('The interface includes all public functions', async () => {
    // log any missing entries
    unlockContract.abi
      .filter((x) => x.type === 'function')
      .forEach((entry) => {
        if (
          unlockInterface.abi.filter((x) => x.name === entry.name).length > 0
        ) {
          return
        }
        // eslint-disable-next-line no-console
        console.log(entry)
      })

    // and assert the count matches
    const count = unlockInterface.abi.filter(
      (x) => x.type === 'function'
    ).length
    const expected = unlockContract.abi.filter(
      (x) => x.type === 'function'
    ).length
    assert.notEqual(count, 0)
    assert.equal(count, expected)
  })
})
