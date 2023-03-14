const algorithms = require('./data/algorithms');

algorithms.forEach(function([algo, vector]) {
  contract(algo, function(accounts) {
    const algorithm = artifacts.require('./algorithms/' + algo + '.sol');

    it('should return true for valid signatures', async function() {
      var instance = await algorithm.deployed();

      assert.equal(
        await instance.verify(vector[0], vector[1], vector[2]),
        true
      );
    });

    it('should return false for invalid signatures', async function() {
      var instance = await algorithm.deployed();

      vector[1] = vector[1] + '00';
      assert.equal(
        await instance.verify(vector[0], vector[1], vector[2]),
        false
      );
    });
  });
});
