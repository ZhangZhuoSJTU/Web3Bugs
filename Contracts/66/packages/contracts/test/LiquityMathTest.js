const LiquityMathTester = artifacts.require("./LiquityMathTester.sol")

contract('LiquityMath', async accounts => {
  let liquityMathTester
  beforeEach('deploy tester', async () => {
    liquityMathTester = await LiquityMathTester.new()
  })

  const checkFunction = async (func, cond, params) => {
    assert.equal(await liquityMathTester[func](...params), cond(...params))
  }

  it('max works if a > b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 1])
  })

  it('max works if a = b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 2])
  })

  it('max works if a < b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [1, 2])
  })
})
