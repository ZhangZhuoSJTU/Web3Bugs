const digests = require('./data/digests');
const { expectRevert } = require('@openzeppelin/test-helpers');

digests.forEach(function(testcase) {
  contract(testcase.digest, function(accounts) {
    const algorithm = artifacts.require('./digests/' + testcase.digest + '.sol');

    it('should return true for valid hashes', async function() {
      var instance = await algorithm.deployed();
      await Promise.all(testcase.valids.map(async function([text, digest]) {
        assert.equal(await instance.verify(ethers.utils.hexlify(ethers.utils.toUtf8Bytes(text)), digest), true);
      }));
    });

    it('should return false for invalid hashes', async function() {
      var instance = await algorithm.deployed();
      await Promise.all(testcase.invalids.map(async function([text, digest]) {
        assert.equal(await instance.verify(ethers.utils.hexlify(ethers.utils.toUtf8Bytes(text)), digest), false);
      }));
    });

    it('should throw an error for hashes of the wrong form', async function() {
      var instance = await algorithm.deployed();
      await Promise.all(testcase.errors.map(async function([text, digest]) {
        await expectRevert.unspecified(instance.verify(ethers.utils.hexlify(ethers.utils.toUtf8Bytes(text)), digest));
      }));
    });
  });
});
