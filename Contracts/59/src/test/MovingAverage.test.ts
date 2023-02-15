import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { MovingAverage } from "../type/MovingAverage";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, setNextBlockTime, increaseTime } from "./helpers";

const { deployMockContract } = waffle;

describe("MovingAverage", function() {
  let accounts: Signer[];
  let owner: Signer;
  let updater: Signer;
  let timelock: Signer;
  let snapshotId: string;
  let movingAverage: MovingAverage;

  let sampleLength: number = 30; // 30 seconds
  let sampleMemory: number = 120; // 1 hour worth
  let defaultValue: BigNumber = utils.parseEther('2');

  let initialTime: number;
  let currentTime: number;

  async function increaseNextBlockTime(amount: number) {
    currentTime += amount;
    await setNextBlockTime(currentTime);
  }

  async function resetBlockTime() {
    initialTime = Math.floor((new Date().getTime()) / 1000) + 10;
    currentTime = initialTime;
    await setNextBlockTime(currentTime);
  }

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, updater, timelock, ...accounts] = await ethers.getSigners();
    const MovingAverageFactory = await ethers.getContractFactory("MovingAverage");

    const ownerAddress = await owner.getAddress();
    const timelockAddress = await timelock.getAddress();
    const updaterAddress = await updater.getAddress();

    movingAverage = (await MovingAverageFactory.deploy()) as MovingAverage;

    await movingAverage.initialize(
      timelockAddress,
      ownerAddress,
      sampleLength,
      sampleMemory,
      updaterAddress,
      defaultValue
    );
    await resetBlockTime();
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial state", async function() {
    expect(await movingAverage.sampleLength()).to.equal(sampleLength);
    expect(await movingAverage.sampleMemory()).to.equal(sampleMemory);
    expect(await movingAverage.defaultValue()).to.equal(defaultValue);
    expect(await movingAverage.cumulativeValue()).to.equal(0);
  });

  it("Returns default from getValue when no data is present", async function() {
    expect(await movingAverage.getValue()).to.equal(defaultValue);
  });

  it("Returns default from getValueWithLookback when no data is present", async function() {
    expect(await movingAverage.getValueWithLookback(0)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(10)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(40)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(60)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(80)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(100)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(120)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(160)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(600)).to.equal(defaultValue);
  });

  it("Allows updater, timelock and initialAdmin to call update method", async function() {
    const value = utils.parseEther('0.84');

    await movingAverage.connect(updater).update(value);
    await movingAverage.connect(owner).update(value);
  });

  it("Disallows non updater calling update method", async function() {
    const value = utils.parseEther('0.84');

    const randomAccount = accounts[0];

    await expect(movingAverage.connect(randomAccount).update(value)).to.be.reverted;
    await expect(movingAverage.connect(timelock).update(value)).to.be.reverted;
  });

  it("Disallows non updater calling updateCumulative method", async function() {
    const value = utils.parseEther('0.84');

    const randomAccount = accounts[0];

    await expect(movingAverage.connect(randomAccount).updateCumulative(value)).to.be.reverted;
  });

  it("Can update a single value but getValue still returns default", async function() {
    const value = utils.parseEther('0.84');

    const tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    expect(await movingAverage.getValue()).to.equal(defaultValue);
  });

  it("Can update a single cumulative value but getValue still returns default", async function() {
    const value = utils.parseEther('0.84');

    const tx = await movingAverage.connect(updater).updateCumulative(value);
    await tx.wait();

    expect(await movingAverage.getValue()).to.equal(defaultValue);
  });

  it("Second update results in first update returning from getValue", async function() {
    const value = utils.parseEther('0.84');

    let tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    const secondValue = utils.parseEther('0.44');

    tx = await movingAverage.connect(updater).update(secondValue);
    await tx.wait();

    expect(await movingAverage.getValue()).to.equal(value);
  });

  it("Second cumulative update results in first value being returned", async function() {
    const value = utils.parseEther('0.84');

    let tx = await movingAverage.connect(updater).updateCumulative(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    tx = await movingAverage.connect(updater).updateCumulative(value.add(value.mul(sampleLength)));
    await tx.wait();

    expect(await movingAverage.getValue()).to.equal(value);
  });

  it("Can update a single value but getValueWithLookback will return default", async function() {
    const value = utils.parseEther('0.84');

    const tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    expect(await movingAverage.getValueWithLookback(0)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(10)).to.equal(defaultValue);
  });

  it("Can update a single cumulative value but getValueWithLookback will return default", async function() {
    const value = utils.parseEther('0.84');

    const tx = await movingAverage.connect(updater).updateCumulative(value);
    await tx.wait();

    expect(await movingAverage.getValueWithLookback(0)).to.equal(defaultValue);
    expect(await movingAverage.getValueWithLookback(10)).to.equal(defaultValue);
  });

  it("Second update results in first update returning from getValue", async function() {
    const value = utils.parseEther('0.84');

    let tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    const secondValue = utils.parseEther('0.44');

    tx = await movingAverage.connect(updater).update(secondValue);
    await tx.wait();

    expect(await movingAverage.getValueWithLookback(0)).to.equal(value);
    expect(await movingAverage.getValueWithLookback(10)).to.equal(value);
  });

  it("Second cumulative update results in first value being returned from getValueWithLookback", async function() {
    const value = utils.parseEther('0.84');

    let tx = await movingAverage.connect(updater).updateCumulative(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    tx = await movingAverage.connect(updater).updateCumulative(value.add(value.mul(sampleLength)));
    await tx.wait();

    expect(await movingAverage.getValueWithLookback(0)).to.equal(value);
    expect(await movingAverage.getValueWithLookback(10)).to.equal(value);
  });

  it("Can handle 2 updates in the same sample period", async function() {
    // Set initial value
    let value = utils.parseEther('0.7');
    let tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('0.8');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength / 2);

    value = utils.parseEther('0.9');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    // One final update
    value = utils.parseEther('1');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.85'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.85'));

    // 300 seconds therefore 10 sample lookback
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.85'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.85'));

    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('1.1');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.95'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.95'));

    // 300 seconds therefore 10 sample lookback
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.9'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.9'));
  });

  it("Can handle a several sample gap between updates", async function() {
    // Set initial value
    let value = utils.parseEther('0.7');
    let tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('0.8');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength * 5);

    value = utils.parseEther('0.9');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.8'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.8'));

    // 300 seconds therefore 10 sample lookback
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.8'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.8'));

    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('1');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.9'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.9'));

    // 300 seconds therefore 10 sample lookback
    // 5/6ths of 0.8 and 1/6th of 0.9 = 0.8166
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.816666666666666666'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.816666666666666666'));
  });

  it("Can handle a gap between updates that is larger than total sample memory", async function() {
    // Set initial value
    let value = utils.parseEther('0.7');
    let tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('0.8');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength * sampleMemory * 2);

    value = utils.parseEther('0.9');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.8'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.8'));

    // 300 seconds therefore 10 sample lookback
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.8'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.8'));

    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('1');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.9'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.9'));

    // 300 seconds therefore 10 sample lookback
    // 9/10 of 0.8 and 1/10th of 0.9 = 0.81
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.81'));

    // 120 Sample lookback
    // 119/120 of 0.8 and 1/120th of 0.9 = 0.81
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.800847457627118644'));
  });

  it("Can handle zero values", async function() {
    // Set initial value
    let value = utils.parseEther('0.7');
    let tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('0.8');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();

    await increaseNextBlockTime(sampleLength * sampleMemory * 2);

    value = utils.parseEther('0');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();
    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('0');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();
    await increaseNextBlockTime(sampleLength);

    value = utils.parseEther('0');
    tx = await movingAverage.connect(updater).update(value);
    await tx.wait();
    await increaseNextBlockTime(sampleLength);

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0'));
    // 60 seconds therefore 2 sample lookback
    expect(await movingAverage.getValueWithLookback(60)).to.equal(utils.parseEther('0'));

    // 300 seconds therefore 10 sample lookback
    // 8/10 of 0.8 and 2/10th of 0 = 0.64
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.64'));

    // 118/120 of 0.8 and 2/120th of 0 = 0.786
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.786440677966101694'));
  });

  it("Can handle 2 cumulative updates in the same sample period", async function() {
    // Set initial value
    let cumulative = utils.parseEther('0.7');
    let tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    cumulative = cumulative.add(utils.parseEther('0.7').mul(sampleLength));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength / 2);

    cumulative = cumulative.add(utils.parseEther('0.8').mul(sampleLength / 2));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    // One final update
    cumulative = cumulative.add(utils.parseEther('0.9').mul(sampleLength));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.85'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.85'));

    // 300 seconds therefore 10 sample lookback
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.85'));

    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.85'));

    await increaseNextBlockTime(sampleLength);

    cumulative = cumulative.add(utils.parseEther('1').mul(sampleLength));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.95'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.95'));

    // 300 seconds therefore 10 sample lookback
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.9'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.9'));
  });

  it("Can handle a several sample gap between cumulative updates", async function() {
    // Set initial value
    let cumulative = utils.parseEther('0.7');
    let tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    cumulative = cumulative.add(utils.parseEther('0.7').mul(sampleLength));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength * 5);

    cumulative = cumulative.add(utils.parseEther('0.8').mul(sampleLength * 5));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.8'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.8'));

    // 300 seconds therefore 10 sample lookback
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.8'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.8'));

    await increaseNextBlockTime(sampleLength);

    cumulative = cumulative.add(utils.parseEther('0.9').mul(sampleLength));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.9'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.9'));

    // 300 seconds therefore 10 sample lookback
    // 5/6ths of 0.8 and 1/6th of 0.9 = 0.8166
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.816666666666666666'));

    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.816666666666666666'));
  });

  it("Can handle a gap between cumulative updates that is larger than total sample memory", async function() {
    // Set initial value
    let cumulative = utils.parseEther('0.7');
    let tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    cumulative = cumulative.add(utils.parseEther('0.7').mul(sampleLength));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength * sampleMemory * 2);

    cumulative = cumulative.add(utils.parseEther('0.8').mul(sampleLength * sampleMemory * 2));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.8'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.8'));

    // 300 seconds therefore 10 sample lookback
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.8'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.8'));

    await increaseNextBlockTime(sampleLength);

    cumulative = cumulative.add(utils.parseEther('0.9').mul(sampleLength));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0.9'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0.9'));

    // 300 seconds therefore 10 sample lookback
    // 9/10 of 0.8 and 1/10th of 0.9 = 0.81
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.81'));
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.800847457627118644'));
  });

  it("Can handle subsequent samples with same cumulative ie 0 value over a period", async function() {
    // Set initial value
    let cumulative = utils.parseEther('0.7');
    let tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength);

    cumulative = cumulative.add(utils.parseEther('0.7').mul(sampleLength));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();

    await increaseNextBlockTime(sampleLength * sampleMemory * 2);

    cumulative = cumulative.add(utils.parseEther('0.8').mul(sampleLength * sampleMemory * 2));
    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();
    await increaseNextBlockTime(sampleLength);

    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();
    await increaseNextBlockTime(sampleLength);

    tx = await movingAverage.connect(updater).updateCumulative(cumulative);
    await tx.wait();
    await increaseNextBlockTime(sampleLength);

    // 0 sample lookback
    expect(await movingAverage.getValueWithLookback(0)).to.equal(utils.parseEther('0'));
    // 10 seconds therefore 1 sample lookback
    expect(await movingAverage.getValueWithLookback(10)).to.equal(utils.parseEther('0'));
    // 60 seconds therefore 2 sample lookback
    expect(await movingAverage.getValueWithLookback(60)).to.equal(utils.parseEther('0'));

    // 300 seconds therefore 10 sample lookback
    // 8/10 of 0.8 and 2/10th of 0 = 0.64
    expect(await movingAverage.getValueWithLookback(300)).to.equal(utils.parseEther('0.64'));

    // 118/120 of 0.8 and 2/120th of 0 = 0.786
    expect(await movingAverage.getValue()).to.equal(utils.parseEther('0.786440677966101694'));
  });
  
  describe("With full stream of updated values data", function() {
    let samples: number[] = [];
    let average: number;

    beforeEach(async function() {
      let total = 0;
      samples = []

      for (let i = 0; i < sampleMemory; i++) {
        let randomSample = parseFloat(Math.random().toFixed(5));

        samples.push(randomSample);
        total += randomSample;

        await increaseNextBlockTime(sampleLength);
        await movingAverage.connect(updater).update(utils.parseEther(randomSample.toString()));
      }

      // The last sample isn't counted towards the average
      average = (total - samples[samples.length - 1] - samples[0]) / (samples.length - 2);
    });

    it("Can correctly fetch global average", async function() {
      const averageBN = utils.parseEther(average.toString());

      const value = await movingAverage.getValue();
      expect(value).to.be.near(averageBN);
    });

    it("Can correctly fetch global average using lookback", async function() {
      const averageBN = utils.parseEther(average.toString());

      // This actually looks back further than memory given the first sample is considered present time
      // so it should return global anyway
      let value = await movingAverage.getValueWithLookback(sampleLength * sampleMemory);
      expect(value).to.be.near(averageBN);

      // this actually looks at average of all samples using lookback 
      value = await movingAverage.getValueWithLookback(sampleLength * sampleMemory - 1);
      expect(value).to.be.near(averageBN);
    });

    it("Excessive lookback just returns global average", async function() {
      const averageBN = utils.parseEther(average.toString());

      const value = await movingAverage.getValueWithLookback(sampleLength * sampleMemory * 10);
      expect(value).to.be.near(averageBN);
    });

    it("Can correctly fetch single sample average after update", async function() {
      // Look back a single sample length. The average value over that period
      // should just be equal to the value of the second to last sample

      // Current sample is always considered to be most up to date value.
      // So looking back 1 sample length will look to the sample before the current one
      const currentSampleIndex = samples.length - 1;
      const averageBN = utils.parseEther(samples[currentSampleIndex - 1].toString());

      const value = await movingAverage.getValueWithLookback(sampleLength);
      expect(value).to.equal(averageBN);
    });

    it("Tiny lookback correctly fetches single sample average", async function() {
      const currentSampleIndex = samples.length - 1;
      const averageBN = utils.parseEther(samples[currentSampleIndex - 1].toString());

      const value = await movingAverage.getValueWithLookback(1);
      expect(value).to.equal(averageBN);
    });

    it("Can correctly fetch 10 sample average", async function() {
      const currentSampleIndex = samples.length - 1;
      const sampleLookback = 10;
      const initialIndex = currentSampleIndex - sampleLookback;

      let sampleAverage = 0;
      for (let i = initialIndex; i < currentSampleIndex; i++) {
        sampleAverage += samples[i];
      }
      sampleAverage /= sampleLookback;
      const averageBN = utils.parseEther(sampleAverage.toString());

      const value = await movingAverage.getValueWithLookback(sampleLength * sampleLookback);

      // within 1000 of average. Avoids rounding errors etc
      expect(value).to.be.near(averageBN, 1000);
    });

    it("Can correctly fetch 87 sample average", async function() {
      const currentSampleIndex = samples.length - 1;
      const sampleLookback = 87;
      const initialIndex = currentSampleIndex - sampleLookback;

      let sampleAverage = 0;
      for (let i = initialIndex; i < currentSampleIndex; i++) {
        sampleAverage += samples[i];
      }
      sampleAverage /= sampleLookback;
      const averageBN = utils.parseEther(sampleAverage.toString());

      const value = await movingAverage.getValueWithLookback(sampleLength * sampleLookback);

      // within 1000 of average. Avoids rounding errors etc
      expect(value).to.be.near(averageBN, 1000);
    });
  });

  describe("With full stream of updated cumulative value data", function() {
    let samples: number[] = [];
    let cumulativeSamples: number[] = [];
    let average: number;

    beforeEach(async function() {
      let total = 0;
      samples = [];
      cumulativeSamples = [];

      for (let i = 0; i < sampleMemory; i++) {
        let randomSample = parseFloat(Math.random().toFixed(5));

        samples.push(randomSample);
        total += randomSample;
      }

      // Add the first sample
      await movingAverage.connect(updater).updateCumulative(utils.parseEther(samples[0].toString()));

      let currentCumulative = samples[0];

      for (let i = 0; i < samples.length; i++) {
        await increaseNextBlockTime(sampleLength);

        currentCumulative += samples[i] * sampleLength;

        cumulativeSamples.push(currentCumulative);

        await movingAverage.connect(updater).updateCumulative(utils.parseEther(currentCumulative.toString()));
      }

      // The first sample isn't included as it is overwriten by the new "live" sample.
      // (sampleMemory - 2) is used due to the first sample not being used.
      // If sampleMemory is 2, then total time between them is sampleLength * 1 
      // so in general sampleLength * (sampleMemory - 1) is the total time. Minus another
      // 1 to account for not using the first sample
      average = (cumulativeSamples[samples.length - 1] - cumulativeSamples[1]) / (sampleLength * (sampleMemory - 2))
    });

    it("Can correctly fetch global average", async function() {
      const averageBN = utils.parseEther(average.toString());

      // Calculated average can vary slightly due to discrepencies with increasing time
      // So assert it is within 1%
      const value = await movingAverage.getValue();
      expect(value).to.be.near(averageBN, 1000);
    });

    it("Can correctly fetch global average using lookback", async function() {
      const averageBN = utils.parseEther(average.toString());

      // This actually looks back further than memory given the first sample is considered present time
      // so it should return global anyway
      let value = await movingAverage.getValueWithLookback(sampleLength * sampleMemory);
      expect(value).to.be.near(averageBN, 1000);

      // this actually looks at average of all samples using lookback 
      value = await movingAverage.getValueWithLookback(sampleLength * sampleMemory - 1);
      expect(value).to.be.near(averageBN, 1000);
    });

    it("Excessive lookback just returns global average", async function() {
      const averageBN = utils.parseEther(average.toString());

      // Calculated average can vary slightly due to discrepencies with increasing time
      // So assert it is within 1%
      const value = await movingAverage.getValueWithLookback(sampleLength * sampleMemory * 10);
      expect(value).to.be.near(averageBN, 1000);
    });

    it("Can correctly fetch single sample average after updateCumulative", async function() {
      // Look back a single sample length. The average value over that period
      // should just be equal to the value of the second to last sample

      // Because we are updating cumulative data here, the most recently seen
      // data point is the second to last sample (the last one would only make
      // a cumulative value on the next loop through)
      const currentSampleIndex = samples.length - 1;
      const averageBN = utils.parseEther(samples[currentSampleIndex].toString());

      const value = await movingAverage.getValueWithLookback(sampleLength);
      expect(value).to.be.near(averageBN);
    });

    it("Tiny lookback correctly fetches single sample average", async function() {
      const currentSampleIndex = samples.length - 1;
      const averageBN = utils.parseEther(samples[currentSampleIndex].toString());

      const value = await movingAverage.getValueWithLookback(1);

      // within 1000 of average. Avoids rounding errors etc
      expect(value).to.be.near(averageBN);
    });

    it("Can correctly fetch 10 sample average", async function() {
      const currentSampleIndex = samples.length - 1;
      const activeSampleIndex = currentSampleIndex;
      const sampleLookback = 10;
      const initialIndex = activeSampleIndex - sampleLookback;

      let sampleDiff = cumulativeSamples[activeSampleIndex] - cumulativeSamples[initialIndex];
      let sampleAverage = sampleDiff / (sampleLookback * sampleLength);
      const averageBN = utils.parseEther(sampleAverage.toString());

      const value = await movingAverage.getValueWithLookback(sampleLength * sampleLookback);

      // within 1000 of average. Avoids rounding errors etc
      expect(value).to.be.near(averageBN, 1000);
    });

    it("Can correctly fetch 87 sample average", async function() {
      const currentSampleIndex = samples.length - 1;
      const activeSampleIndex = currentSampleIndex;
      const sampleLookback = 87;
      const initialIndex = activeSampleIndex - sampleLookback;

      let sampleDiff = cumulativeSamples[activeSampleIndex] - cumulativeSamples[initialIndex];
      let sampleAverage = sampleDiff / (sampleLookback * sampleLength);
      const averageBN = utils.parseEther(sampleAverage.toString());

      const value = await movingAverage.getValueWithLookback(sampleLength * sampleLookback);

      // within 1000 of average. Avoids rounding errors etc
      expect(value).to.be.near(averageBN, 1000);
    });
  });
});

// TODO set priv methods Thu 30 Sep 2021 18:54:05 BST
