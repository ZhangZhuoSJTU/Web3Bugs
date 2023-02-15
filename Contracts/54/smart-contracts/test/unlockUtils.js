const mockArtifact = artifacts.require('UnlockUtilsMock')

let mock

contract('unlockUtils', (accounts) => {
  before(async () => {
    mock = await mockArtifact.new()
  })

  describe('function uint2str', () => {
    let str1
    let str2
    it('should convert a uint to a string', async () => {
      str1 = await mock.uint2Str.call(0)
      assert.equal(str1, '0')
      str2 = await mock.uint2Str.call(42)
      assert.equal(str2, '42')
    })
  })

  describe('function strConcat', () => {
    let resultingStr

    it('should concatenate 4 strings', async () => {
      resultingStr = await mock.strConcat.call('hello', '-unlock', '/', '42')
      assert.equal(resultingStr, 'hello-unlock/42')
    })
  })

  describe('function address2Str', () => {
    let senderAddress
    // currently returns the address as a string with all chars in lowercase
    it('should convert an ethereum address to an ASCII string', async () => {
      senderAddress = await mock.address2Str.call(accounts[0])
      assert.equal(web3.utils.toChecksumAddress(senderAddress), accounts[0])
    })
  })
})
