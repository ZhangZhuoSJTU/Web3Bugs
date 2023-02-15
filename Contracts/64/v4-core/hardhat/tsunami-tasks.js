const { BigNumber, constants } = require('ethers');
const tiers = require('./prizeDistributions');

task('deposit-to')
  .addPositionalParam('address', 'PrizePool address')
  .addPositionalParam('amount', 'amount')
  .addPositionalParam('to', 'to')
  .addPositionalParam('controlledToken', 'controlledToken')
  .setAction(async function ({ address, amount, to, controlledToken }) {
    const contract = await ethers.getContractAt('YieldSourcePrizePool', address);
    await contract.depositTo(amount, to, controlledToken, constants.AddressZero);
    console.log(`Deposit To: ${address}`);
  });

task('push-draw')
  .addPositionalParam('address', 'Draw Buffer address')
  .addPositionalParam('drawId', 'drawId')
  .addPositionalParam('timestamp', 'timestamp')
  .addPositionalParam('winningRandomNumber', 'winningRandomNumber')
  .setAction(async function ({ address, drawId, timestamp, winningRandomNumber }) {
    const contract = await ethers.getContractAt('DrawBuffer', address);
    await contract.addDraw({
      drawId: drawId,
      timestamp: timestamp,
      winningRandomNumber: winningRandomNumber,
    });
    console.log(`Draw Created: ${address}`);
  });

task('set-draw-settings')
  .addPositionalParam('address', 'DrawCalculator address')
  .addPositionalParam('drawId', 'drawId')
  .addPositionalParam('bitRangeSize', 'bitRangeSize')
  .addPositionalParam('matchCardinality', 'matchCardinality')
  .addPositionalParam('numberOfPicks', 'numberOfPicks')
  .addPositionalParam('prize', 'prize')
  .setAction(async function ({
    address,
    drawId,
    bitRangeSize,
    matchCardinality,
    numberOfPicks,
    prize,
  }) {
    const contract = await ethers.getContractAt('DrawBuffer', address);
    await contract.pushPrizeDistribution(drawId, {
      bitRangeSize: BigNumber.from(bitRangeSize),
      matchCardinality: BigNumber.from(matchCardinality),
      numberOfPicks: BigNumber.from(utils.parseEther(`${numberOfPicks}`)),
      prize: ethers.utils.parseEther(`${prize}`),
      tiers: tiers,
    });
    console.log(`Draw Setings updated: ${address}`);
  });
