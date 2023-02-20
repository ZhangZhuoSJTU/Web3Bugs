const { utils } = require('ethers');

const tiers = [
  utils.parseEther('0.9'),
  utils.parseEther('0.1'),
  utils.parseEther('0.1'),
  utils.parseEther('0.1'),
];

module.exports = tiers;
